/**
 * The one signature visual element every status value in the app renders
 * through — order status, stock level, fulfillment type. Styled like a
 * library due-date ink stamp (dashed ring, slight rotation, small-caps
 * mono label) so a status reads the same whether it's on a catalog card,
 * the account page, or the staff dashboard.
 */

export type StampTone = "positive" | "pending" | "negative" | "neutral";

const TONE_CLASSES: Record<StampTone, string> = {
  positive: "border-accent text-accent",
  pending: "border-gold text-gold",
  negative: "border-claret text-claret",
  neutral: "border-ink/30 text-ink/60",
};

const TONE_ROTATION: Record<StampTone, string> = {
  positive: "-rotate-2",
  pending: "rotate-1",
  negative: "-rotate-1",
  neutral: "rotate-2",
};

export function StampBadge({
  children,
  tone,
  className = "",
}: {
  children: React.ReactNode;
  tone: StampTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-dashed px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]} ${TONE_ROTATION[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
