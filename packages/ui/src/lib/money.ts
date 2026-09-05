/**
 * The one place paise become rupees.
 *
 * Amounts are integer paise everywhere in the system — in props, in state, in
 * the database. They become a ₹ string here and nowhere else.
 */
export function formatPaise(paise: number, currency = "INR"): string {
  const rupees = paise / 100;

  /*
   * Whole rupees lose the decimals; anything else keeps both of them. The
   * minimum used to be zero, which turned ₹30,099.30 into "₹30,099.3" — a
   * price with one decimal place reads as a rounding error rather than a
   * price, and this string is shown to merchants next to a cost they are
   * deciding against.
   */
  const decimals = Number.isInteger(rupees) ? 0 : 2;

  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
    style: "currency",
  }).format(rupees);
}
