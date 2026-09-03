/**
 * Money formatting lives in the UI package so components there can reach it
 * too. Re-exported here so existing call sites keep their import path.
 */
export { formatPaise } from "@workspace/ui/lib/money";

export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

/** Turns AUDIT_ACTION_NAMES into "Audit action names". */
export function humanizeAction(action: string): string {
  const words = action.toLowerCase().replace(/_/g, " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}
