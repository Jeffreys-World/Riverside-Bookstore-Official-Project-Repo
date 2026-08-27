"use client";

import { useState } from "react";

type CardImageAspect = "portrait" | "square" | "video";

const ASPECT_CLASS: Record<CardImageAspect, string> = {
  portrait: "aspect-[2/3]",
  square: "aspect-square",
  video: "aspect-video",
};

/**
 * Standard image header for catalog cards (books, merchandise, events).
 * Falls back to the same muted placeholder whether the image is simply
 * missing (no URL) or broken (a URL that 404s or fails to load) — a
 * viewer can't tell those apart and shouldn't have to.
 */
export function CardImage({
  src,
  alt,
  aspect,
  emptyLabel = "No image available",
}: {
  src: string | null;
  alt: string;
  aspect: CardImageAspect;
  emptyLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !src || failed;

  return (
    <div className={`w-full flex-none overflow-hidden ${ASPECT_CLASS[aspect]}`}>
      {showPlaceholder ? (
        // Branded typographic placeholder — a warm accent-tinted panel
        // with the wordmark mark, not a bare "no image" grey box.
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-accent-soft px-3 text-center">
          <span aria-hidden className="font-serif text-2xl leading-none text-accent/70">
            R
          </span>
          <span className="text-[10px] uppercase tracking-wide text-ink/45">{emptyLabel}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
