"use client";

import { useEffect, useRef } from "react";

const SIZE = 1080; // square, matches a standard social post canvas.

// Same hex values as tailwind.config.ts's brand palette — canvas can't
// read CSS custom properties, so these are duplicated here rather than
// pulled from a shared source. Each entry pairs a background with the
// foreground color that reads clearly on it (light text on the two dark
// backgrounds, dark ink text on the three light/warm ones).
const PALETTE: Array<{ bg: string; fg: string; footer: string }> = [
  { bg: "#3F6C51", fg: "#F6F1E4", footer: "#E4EDE7" }, // accent
  { bg: "#1B2E28", fg: "#F6F1E4", footer: "#B08D3F" }, // ink
  { bg: "#B08D3F", fg: "#1B2E28", footer: "#F6F1E4" }, // gold
  { bg: "#7A2E2E", fg: "#F7E9E9", footer: "#F6F1E4" }, // claret
  { bg: "#EFE7D3", fg: "#1B2E28", footer: "#3F6C51" }, // surface
];

// Deterministic, not random — the same headline always produces the same
// card, so regenerating content for the same book/event looks consistent
// rather than shuffling colors on every render.
function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function GeneratedImage({ headline, subtitle }: { headline: string; subtitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { bg, fg, footer } = paletteFor(headline || subtitle || "riverside");
    const margin = 96;
    const maxWidth = SIZE - margin * 2;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Headline, vertically centered as a block — canvas has no native
    // text-wrapping, so lines are measured and broken by hand.
    ctx.fillStyle = fg;
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 72px Georgia, serif";
    const headlineLines = wrapLines(ctx, headline || "Riverside Books", maxWidth).slice(0, 5);
    const headlineLineHeight = 84;

    ctx.font = "32px Georgia, serif";
    const subtitleLines = subtitle ? wrapLines(ctx, subtitle, maxWidth).slice(0, 2) : [];
    const subtitleLineHeight = 44;
    const subtitleGap = subtitleLines.length > 0 ? 32 : 0;

    const blockHeight =
      headlineLines.length * headlineLineHeight + subtitleGap + subtitleLines.length * subtitleLineHeight;
    let y = (SIZE - blockHeight) / 2 + headlineLineHeight * 0.75;

    ctx.font = "bold 72px Georgia, serif";
    ctx.textAlign = "center";
    for (const line of headlineLines) {
      ctx.fillText(line, SIZE / 2, y, maxWidth);
      y += headlineLineHeight;
    }

    if (subtitleLines.length > 0) {
      y += subtitleGap - headlineLineHeight + subtitleLineHeight * 0.6;
      ctx.font = "32px Georgia, serif";
      ctx.globalAlpha = 0.85;
      for (const line of subtitleLines) {
        ctx.fillText(line, SIZE / 2, y, maxWidth);
        y += subtitleLineHeight;
      }
      ctx.globalAlpha = 1;
    }

    // Footer wordmark, pinned near the bottom.
    ctx.fillStyle = footer;
    ctx.font = "600 28px Arial, sans-serif";
    ctx.fillText("RIVERSIDE BOOKS", SIZE / 2, SIZE - 72);
  }, [headline, subtitle]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "riverside-books-post.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-surface p-4">
      <h3 className="font-serif text-lg text-ink">Social image</h3>
      <p className="mt-1 text-xs text-ink/50">
        A branded graphic generated from this content — not AI-rendered artwork (that needs a paid
        Gemini image model this project&apos;s API key doesn&apos;t have), just a quick square post
        staff can use as-is or swap for a real photo later.
      </p>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="mt-3 aspect-square w-full max-w-xs rounded-md"
      />
      <button
        type="button"
        onClick={handleDownload}
        className="mt-3 min-h-[44px] rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink"
      >
        Download image
      </button>
    </div>
  );
}
