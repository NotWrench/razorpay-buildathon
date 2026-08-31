/**
 * Every amount in this codebase is an integer number of paise, matching
 * `products.price`, `orders.total_amount` and `payments.amount`. Formatting
 * happens at the very edge — never in the middle of a calculation.
 */

const PAISE_PER_RUPEE = 100;

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** "₹24,999" — no decimals when the amount is whole rupees. */
export function formatPaise(paise: number, currency = "INR"): string {
  const rupees = paiseToRupees(paise);

  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(rupees);
}

/** Applies a percentage discount, rounded down to whole paise. */
export function percentageOff(amountPaise: number, percent: number): number {
  return Math.floor((amountPaise * percent) / 100);
}
