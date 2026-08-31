"use client";

import { useEffect, useRef } from "react";
import { paletteFor } from "@/lib/brand-palette";

const SIZE = 1080; // square, matches a standard social post canvas.

// The palette and its deterministic seeding moved to lib/brand-palette.ts.
// Canvas still cannot read CSS custom properties, so the hex values are
// still duplicated from globals.css somewhere — but now in one place that
// lib/brand-palette.test.ts holds against the :root block, instead of an
// inline copy that had already drifted to the pre-contrast-fix gold.

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
        role="img"
        aria-label={`Social post graphic: ${headline}${subtitle ? ` — ${subtitle}` : ""}`}
        className="mt-3 aspect-square w-full max-w-xs rounded-md"
      />
      <button
        type="button"
        onClick={handleDownload}
        className="mt-3 min-h-[44px] rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-transform duration-150 hover:scale-105"
      >
        Download image
      </button>
    </div>
  );
}
