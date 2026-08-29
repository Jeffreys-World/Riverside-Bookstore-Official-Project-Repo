"use client";

import { useEffect, useState } from "react";
import { loadCustomerId } from "@/lib/customer-id-storage";

/**
 * Offers the localStorage cust_XXXXX (if this browser holds one) to
 * customerSignUpAction, so a returning customer who signs up keeps their
 * existing points + order history instead of starting fresh.
 *
 * The offer is explicit on purpose: this used to mirror the stored id
 * into a hidden field unconditionally, which meant the first person to
 * sign up on a shop/library machine still holding someone else's
 * (unclaimed) id silently inherited that account. Now the id is shown and
 * only submitted when the visitor ticks the box.
 *
 * Renders nothing on the server / before mount — same hydration-safe
 * pattern as the rest of the localStorage reads in this app.
 */
export function ClaimIdField() {
  const [claimId, setClaimId] = useState("");
  const [link, setLink] = useState(false);

  useEffect(() => {
    setClaimId(loadCustomerId());
  }, []);

  if (!claimId) return null;

  return (
    <div className="rounded-md border border-ink/10 bg-surface px-3 py-3">
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={link}
          onChange={(e) => setLink(e.target.checked)}
          className="mt-1 h-4 w-4 flex-none accent-accent"
        />
        <span>
          Link my existing customer ID <span className="font-mono">{claimId}</span> — its reward
          points and order history come with you.
        </span>
      </label>
      {link && <input type="hidden" name="claim_id" value={claimId} />}
      <p className="mt-2 text-xs text-ink/50">
        Leave this unticked on a shared or in-store computer: that ID belongs to whoever used it
        last.
      </p>
    </div>
  );
}
