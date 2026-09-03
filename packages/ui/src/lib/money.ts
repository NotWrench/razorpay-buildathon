/**
 * The one place paise become rupees.
 *
 * Amounts are integer paise everywhere in the system — in props, in state, in
 * the database. They become a ₹ string here and nowhere else.
 */
export function formatPaise(paise: number, currency = "INR"): string {
  const rupees = paise / 100;

  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(rupees);
}
