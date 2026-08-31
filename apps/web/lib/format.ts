/** Client-safe money formatting. Amounts are always integer paise. */
export function formatPaise(paise: number, currency = "INR"): string {
  const rupees = paise / 100;

  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(rupees);
}

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
