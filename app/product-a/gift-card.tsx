"use client";

import type { MouseEvent } from "react";
import { useProductDrawer } from "@/components/product-drawer-provider";
import { StampBadge } from "@/components/stamp-badge";
import { CardImage } from "@/components/card-image";
import { fulfillmentBadgeFor } from "@/lib/inventory";
import type { MerchandiseCategory, StockStatus } from "@/types/schema";

interface GiftCardProps {
  id: string;
  item_name: string;
  category: MerchandiseCategory;
  price: number;
  status: StockStatus;
  stockQuantity: number | null;
  image_url: string | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function GiftCard(item: GiftCardProps) {
  const { open: openDrawer } = useProductDrawer();
  const badge = fulfillmentBadgeFor(item.status);

  // Stops the card's own onClick from opening the drawer a second time.
  function handleTitleClick(e: MouseEvent) {
    e.stopPropagation();
    handleOpenDetails();
  }

  function handleOpenDetails() {
    openDrawer({
      kind: "gift",
      id: item.id,
      title: item.item_name,
      category: item.category,
      price: item.price,
      status: item.status,
      stockQuantity: item.stockQuantity,
      imageUrl: item.image_url,
    });
  }

  // Same shape as BookCard: the card is the mouse affordance, the name is
  // the real control. Keeps both catalog grids on one keyboard and
  // screen-reader pattern rather than two.
  return (
    <article className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-ink/10 bg-surface transition duration-150 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-lg" onClick={handleOpenDetails}>
      <CardImage src={item.image_url} alt="" aspect="square" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-ink">
          <button
            type="button"
            onClick={handleTitleClick}
            aria-label={`View details for ${item.item_name}`}
            className="text-left hover:underline focus-visible:underline"
          >
            {item.item_name}
          </button>
        </p>
        <p className="text-xs capitalize text-ink/50">{item.category}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="font-mono text-sm font-semibold text-ink">
            {currencyFormatter.format(item.price)}
          </span>
          <StampBadge tone={item.status === "out_of_stock" ? "negative" : badge.tone}>
            {item.status === "out_of_stock" ? "Out of stock" : "In store"}
          </StampBadge>
        </div>
      </div>
    </article>
  );
}
