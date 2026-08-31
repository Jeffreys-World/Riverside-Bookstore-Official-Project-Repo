"use server";

/**
 * Product C — Customer Support Chatbot. Single-turn Gemini function
 * calling: the model decides whether it needs check_inventory,
 * check_order_status, or get_upcoming_events (declared once in
 * lib/live-tools.ts and reused here, same as every other product) to
 * answer, we execute whichever it asks for against live Supabase reads
 * (all read-only, all already RLS/grant-safe for anon — see
 * supabase/migrations/0002_rls_and_functions.sql), then hand the results
 * back for a final natural-language answer.
 *
 * Read-only end to end: no mutations, no realtime, unlike Products A+B.
 */

import type { Content, Part } from "@google/genai";
import { generateTextWithFallback } from "@/lib/gemini";
import { getServerClient } from "@/lib/supabase-server";
import { productCToolDeclarations } from "@/lib/live-tools";
import {
  availabilityNoteFor,
  bookSearchOrFilter,
  evaluateStockStatus,
  merchSearchOrFilter,
} from "@/lib/inventory";
import { formatEventTimestamp } from "@/types/schema";
import type { StockStatus } from "@/types/schema";
import { STORE_HOURS, STORE_POLICIES } from "@/lib/store-info";
import { stripMarkdownEmphasis } from "@/lib/markdown";

const SYSTEM_INSTRUCTION = `You are Riverside Books' customer support assistant.

Use the provided tools for anything about current stock, prices, an order's
status, or upcoming events — never guess those from memory. For hours and
policies, use the information below directly.

check_inventory searches the live catalog. It covers both books (match by
title, author, or ISBN) and the gift shop's cards and gifts (match by item
name), and returns the current price plus a plain-language "availability"
note for every match. Use it for "do you have...", "how much is...",
"anything by <author>", and "do you sell <card/gift>" questions alike.
Relay the availability note as written — do not quote copy counts or
internal status codes, and do not invent numbers. Prices are for
information only — pre-orders and purchases are paid in person at the
store, there is no online checkout.

Store hours:
${STORE_HOURS}

Policies:
${STORE_POLICIES}

Keep answers short and conversational. If a question is outside what you can
check (stock, price, order status, events, hours, policies), say so plainly
rather than making something up.

If a tool result includes "lookup_failed": true, that means the lookup
itself failed — it is NOT the same as an empty result. Tell the customer
you're having trouble checking that right now and suggest trying again
shortly or asking a bookseller in person. Never say a title is out of
stock, or that there are no upcoming events, because of a failed lookup.`;

// Everything the chat result row renders. Author, price and status were
// already computed by check_inventory below and then thrown away, leaving
// the UI with a bare cover thumbnail and forcing the reader to take
// availability from the model's prose. They ride along now so the stamp on
// a chat answer derives from the catalogue query, never from what the model
// wrote — see DESIGN.md, "Product C / C2". description + author_bio are
// carried for the same reason BookCard carries them: opening the shared
// product drawer needs them, and a drawer with an empty description is
// worse than no link at all.
export interface SupportChatBook {
  isbn: string;
  book_title: string;
  author_name: string;
  cover_url: string | null;
  price: number;
  status: StockStatus;
  stock_quantity: number | null;
  description: string | null;
  author_bio: string | null;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  // Covers for any books check_inventory actually matched, kept separate
  // from the tool response text below — the model only needs
  // title/author/price/availability to answer, never the raw image URL.
  matchedBooks: SupportChatBook[]
): Promise<unknown> {
  const supabase = getServerClient();

  if (name === "check_inventory") {
    // Strip characters that would break PostgREST's .or() filter syntax
    // rather than reject the query outright — a title with a comma or
    // parenthesis should still degrade to "no match" instead of erroring.
    const query = String(args.query ?? "").replace(/[,()]/g, "").trim();
    if (!query) return { books: [], merchandise: [] };

    // Books match on title / author / ISBN; the gift shop's cards and
    // gifts match on item name. Run both so one check_inventory call can
    // answer "anything by Orwell?" and "do you sell bookmarks?" alike.
    const [booksRes, merchRes] = await Promise.all([
      supabase
        .from("books")
        .select(
          "isbn, book_title, author_name, stock_quantity, price, cover_url, description, author_bio"
        )
        .or(bookSearchOrFilter(query))
        .limit(5),
      supabase
        .from("merchandise")
        .select("item_name, category, stock_quantity, price")
        .or(merchSearchOrFilter(query))
        .limit(5),
    ]);

    if (booksRes.error || merchRes.error) {
      console.error(
        `Product C check_inventory query failed: books=${booksRes.error?.message ?? "ok"} merch=${merchRes.error?.message ?? "ok"}`
      );
      return { books: [], merchandise: [], lookup_failed: true };
    }

    const bookRows = booksRes.data ?? [];
    const bookStatus = evaluateStockStatus(
      bookRows.map((b) => ({ id: b.isbn, stockQuantity: b.stock_quantity }))
    );
    matchedBooks.push(
      ...bookRows.map((b, i) => ({
        isbn: b.isbn,
        book_title: b.book_title,
        author_name: b.author_name,
        cover_url: b.cover_url,
        price: b.price,
        // Same evaluateStockStatus pass the model's availability note is
        // built from on the next lines, so the stamp and the prose can
        // never disagree — they are two renderings of one query result.
        status: bookStatus[i]?.status ?? "needs_attention",
        stock_quantity: b.stock_quantity,
        description: b.description,
        author_bio: b.author_bio,
      }))
    );

    const merchRows = merchRes.data ?? [];
    const merchStatus = evaluateStockStatus(
      merchRows.map((m, i) => ({ id: String(i), stockQuantity: m.stock_quantity }))
    );

    // Hand the model a plain-English availability line, not the raw
    // StockStatus enum or a copy count — it was relaying "needs_attention"
    // verbatim to customers, and any exact count is stale the moment
    // create_preorder runs at checkout.
    return {
      books: bookRows.map((b, i) => ({
        title: b.book_title,
        author: b.author_name,
        price: b.price,
        availability: availabilityNoteFor(bookStatus[i]?.status ?? "needs_attention"),
      })),
      merchandise: merchRows.map((m, i) => ({
        name: m.item_name,
        category: m.category,
        price: m.price,
        availability: availabilityNoteFor(merchStatus[i]?.status ?? "needs_attention", "merch"),
      })),
    };
  }

  if (name === "check_order_status") {
    const orderId = String(args.order_id ?? "");
    const { data, error } = await supabase.rpc("check_order_status", {
      p_order_id: orderId,
    });
    if (error || !data) return { found: false };
    return { found: true, status: data };
  }

  if (name === "get_upcoming_events") {
    const { data, error } = await supabase
      .from("author_events")
      .select("event_title, event_description, author_event_at")
      .gte("author_event_at", new Date().toISOString())
      .order("author_event_at", { ascending: true })
      .limit(5);

    if (error) {
      console.error(`Product C get_upcoming_events query failed: ${error.message}`);
      return { events: [], lookup_failed: true };
    }

    return {
      events: (data ?? []).map((e) => ({
        title: e.event_title,
        description: e.event_description,
        when: formatEventTimestamp(e.author_event_at),
      })),
    };
  }

  return { error: `Unknown tool: ${name}` };
}

export interface SupportChatAnswer {
  answer: string;
  books: SupportChatBook[];
}

function dedupeBooks(books: SupportChatBook[]): SupportChatBook[] {
  const byIsbn = new Map<string, SupportChatBook>();
  for (const b of books) if (!byIsbn.has(b.isbn)) byIsbn.set(b.isbn, b);
  return [...byIsbn.values()];
}

export async function askSupportChatbotAction(question: string): Promise<SupportChatAnswer> {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      answer: "Ask me anything about stock, an order, upcoming events, hours, or policies.",
      books: [],
    };
  }

  const contents: Content[] = [{ role: "user", parts: [{ text: trimmed }] }];
  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: productCToolDeclarations }],
  };
  const matchedBooks: SupportChatBook[] = [];

  // The model can need more than one lookup to answer (e.g. its first
  // check_inventory("greeting cards") comes back empty, so it retries with
  // "card"). Loop until it stops asking for tools or we hit the cap —
  // before this was a single round and any follow-up call left the
  // customer with the generic "couldn't come up with an answer" fallback.
  const MAX_TOOL_ROUNDS = 3;

  try {
    let response = await generateTextWithFallback({ contents, config }, { fast: true });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const calls = response.functionCalls;
      if (!calls || calls.length === 0) break;

      // Replay the model's actual response content, not a reconstruction
      // from response.functionCalls — that getter returns bare
      // FunctionCall objects and drops the sibling thoughtSignature field
      // each Part carries. The fast lane's fallback chain still includes
      // the "thinking" gemini-3.x-flash models, which 400 with "Function
      // call is missing a thought_signature" if that signature isn't
      // echoed back on the next turn. gemini-flash-lite-latest carries no
      // signature and the `?? calls.map(...)` branch covers it.
      const modelParts: Part[] =
        response.candidates?.[0]?.content?.parts ?? calls.map((call) => ({ functionCall: call }));
      contents.push({ role: "model", parts: modelParts });

      const responseParts: Part[] = [];
      for (const call of calls) {
        const result = await executeTool(
          call.name ?? "",
          (call.args ?? {}) as Record<string, unknown>,
          matchedBooks
        );
        responseParts.push({
          functionResponse: { name: call.name ?? "", response: { result } },
        });
      }
      contents.push({ role: "user", parts: responseParts });

      response = await generateTextWithFallback({ contents, config }, { fast: true });
    }

    return {
      // The chat bubble is plain text, so Gemini's markdown emphasis
      // renders as literal asterisks ("Yes, *1984* is in stock") —
      // exactly the ISSUE-002 defect the marketing generator already
      // strips (lib/marketing-parse.ts). Found in Product C by /qa on
      // 2026-08-29.
      answer: stripMarkdownEmphasis(
        response.text ?? "Sorry, I couldn't come up with an answer just now."
      ),
      books: dedupeBooks(matchedBooks),
    };
  } catch (err) {
    console.error(`Support chatbot error: ${err}`);
    return {
      answer: "Something went wrong answering that — please try again, or ask a bookseller in person.",
      books: [],
    };
  }
}
