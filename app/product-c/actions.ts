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
import { evaluateStockStatus } from "@/lib/inventory";
import { formatEventTimestamp } from "@/types/schema";
import { STORE_HOURS, STORE_POLICIES } from "@/lib/store-info";

const SYSTEM_INSTRUCTION = `You are Riverside Books' customer support assistant.

Use the provided tools for anything about current stock, an order's status, or
upcoming events — never guess those from memory. For hours and policies, use
the information below directly.

Store hours:
${STORE_HOURS}

Policies:
${STORE_POLICIES}

Keep answers short and conversational. If a question is outside what you can
check (stock, order status, events, hours, policies), say so plainly rather
than making something up.`;

export interface SupportChatBook {
  isbn: string;
  book_title: string;
  cover_url: string | null;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  // Covers for any books check_inventory actually matched, kept separate
  // from the tool response text below — the model only needs
  // title/author/stock/status to answer, never the raw image URL.
  matchedBooks: SupportChatBook[]
): Promise<unknown> {
  const supabase = getServerClient();

  if (name === "check_inventory") {
    // Strip characters that would break PostgREST's .or() filter syntax
    // rather than reject the query outright — a title with a comma or
    // parenthesis should still degrade to "no match" instead of erroring.
    const query = String(args.query ?? "").replace(/[,()]/g, "").trim();
    if (!query) return { matches: [] };

    const { data } = await supabase
      .from("books")
      .select("isbn, book_title, author_name, stock_quantity, cover_url")
      .or(`isbn.eq.${query},book_title.ilike.%${query}%`)
      .limit(5);

    const rows = data ?? [];
    const flagged = evaluateStockStatus(
      rows.map((b) => ({ id: b.isbn, stockQuantity: b.stock_quantity }))
    );
    matchedBooks.push(
      ...rows.map((b) => ({ isbn: b.isbn, book_title: b.book_title, cover_url: b.cover_url }))
    );
    return {
      matches: rows.map((b, i) => ({
        title: b.book_title,
        author: b.author_name,
        stock_quantity: b.stock_quantity,
        status: flagged[i]?.status,
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
    const { data } = await supabase
      .from("author_events")
      .select("event_title, event_description, author_event_at")
      .gte("author_event_at", new Date().toISOString())
      .order("author_event_at", { ascending: true })
      .limit(5);
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

  try {
    const first = await generateTextWithFallback({ contents, config });

    const calls = first.functionCalls;
    if (!calls || calls.length === 0) {
      return {
        answer: first.text ?? "Sorry, I couldn't come up with an answer just now.",
        books: [],
      };
    }

    // Replay the model's actual response content, not a reconstruction
    // from first.functionCalls — that getter returns bare FunctionCall
    // objects and drops the sibling thoughtSignature field each Part
    // carries. gemini-3.6-flash is a "thinking" model that requires that
    // signature to be echoed back on the next turn; omitting it 400s with
    // "Function call is missing a thought_signature".
    const modelParts: Part[] =
      first.candidates?.[0]?.content?.parts ?? calls.map((call) => ({ functionCall: call }));
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

    const second = await generateTextWithFallback({ contents, config });
    return {
      answer: second.text ?? "Sorry, I couldn't come up with an answer just now.",
      books: dedupeBooks(matchedBooks),
    };
  } catch (err) {
    console.error("Support chatbot error:", err);
    return {
      answer: "Something went wrong answering that — please try again, or ask a bookseller in person.",
      books: [],
    };
  }
}
