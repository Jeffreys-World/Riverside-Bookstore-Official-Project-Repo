"use client";

import { useEffect, useState } from "react";
import { loadCustomerId } from "@/lib/customer-id-storage";

/**
 * Mirrors the localStorage cust_XXXXX (if any) into a hidden form field so
 * customerSignUpAction can adopt it — a returning customer who signs up
 * keeps their existing points + order history instead of starting fresh.
 * Rendered empty on the server; filled after mount, same
 * hydration-safe pattern as the rest of the localStorage reads in this app.
 */
export function ClaimIdField() {
  const [claimId, setClaimId] = useState("");
  useEffect(() => {
    setClaimId(loadCustomerId());
  }, []);
  return <input type="hidden" name="claim_id" value={claimId} />;
}
