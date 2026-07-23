import { cn } from "@/lib/utils";

/**
 * Politeness of an ARIA live region.
 *
 * - `polite` → `role="status"` / `aria-live="polite"`: announced once the
 *   screen reader finishes its current utterance. Use for progress, counts,
 *   empty states — anything that shouldn't interrupt the user.
 * - `assertive` → `role="alert"` / `aria-live="assertive"`: interrupts the
 *   current utterance. Reserve for errors the user needs to hear immediately.
 */
type LiveRegionPoliteness = "polite" | "assertive";

interface LiveRegionProps {
  /**
   * The text to announce. When the region is already mounted, changing this
   * value re-announces; an empty value clears it without announcing. Because
   * `aria-atomic` is set, the whole message is read even on a partial change.
   */
  children?: React.ReactNode;
  /** See {@link LiveRegionPoliteness}. Defaults to `polite`. */
  politeness?: LiveRegionPoliteness;
  /**
   * By default the region is visually hidden (`sr-only`) — the visual state is
   * already conveyed some other way (a skeleton, a spinner) and this node only
   * exists to give the screen reader something to speak. Set `visible` when the
   * message text is itself the visible UI (e.g. a "No results" line or a result
   * count) so the same element serves both audiences without duplicate text.
   */
  visible?: boolean;
  className?: string;
}

/**
 * A single, reusable ARIA live region. Rendering one of these — rather than
 * hand-rolling `<span className="sr-only" role="status" aria-live="polite">` at
 * each call site — keeps the roles, politeness mapping, and `aria-atomic`
 * consistent across the app.
 *
 * Live regions announce most reliably when the region is present in the DOM
 * *before* its text changes. For persistent regions (a list that stays mounted
 * while its count changes) keep this rendered and vary `children`. For content
 * that mounts already-populated (a route-level `loading.tsx` skeleton), mounting
 * with the text present is announced on insertion, which is the expected pattern.
 *
 * Text-only by design: this renders a `<div>` with no interactive content, so it
 * is safe to leave permanently mounted.
 */
export function LiveRegion({
  children,
  politeness = "polite",
  visible = false,
  className,
}: LiveRegionProps) {
  return (
    <div
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness}
      aria-atomic="true"
      className={cn(!visible && "sr-only", className)}
    >
      {children}
    </div>
  );
}
