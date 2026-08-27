/**
 * Product A has no real customer auth — customer_id doubles as the access
 * token a visitor types in. Remembering it in localStorage means "My
 * Account" and the pre-order form don't make a returning customer retype
 * it every visit. Shared between preorder-form.tsx (writes it after
 * signup/a successful order) and account-view.tsx (reads it on load,
 * clears it on log out).
 */

const STORAGE_KEY = "riverside_customer_id";

export function saveCustomerId(customerId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, customerId);
  } catch {
    // Private browsing / storage disabled — not persisting the id just
    // means retyping it next time, not a functional failure.
  }
}

export function loadCustomerId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearCustomerId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled — nothing was persisted to
    // clear, so the in-memory sign-out is all that's needed anyway.
  }
}
