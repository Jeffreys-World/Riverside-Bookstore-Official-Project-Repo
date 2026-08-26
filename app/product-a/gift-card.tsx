"use client";

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

  return (
    <article
      onClick={handleOpenDetails}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpenDetails();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${item.item_name}`}
      className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-ink/10 bg-surface transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <CardImage src={item.image_url} alt="" aspect="square" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-ink">{item.item_name}</p>
        <p className="text-xs capitalize text-ink/50">{item.category}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-mono text-sm font-semibold text-gold">
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
