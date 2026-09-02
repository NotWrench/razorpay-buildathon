import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import type { Metadata } from "next";
import { getCart } from "@/lib/mock";
import { MOCK_PRODUCTS_BY_ID } from "@/lib/mock/products";

/**
 * A stub, and honest about it.
 *
 * The order summary is real; the button does nothing and says so. A checkout
 * that looks finished and silently fails is worse than one that admits it is
 * not wired yet.
 *
 * Two ways in. `?parts=` carries a selection the assistant assembled, and the
 * page prices exactly those lines — arriving here from the build sheet and
 * being shown the cart's total instead would be the app losing the thing you
 * just spent five minutes choosing. Without it, the cart.
 */

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ parts?: string }>;
}) {
  const { parts } = await searchParams;
  const build = (parts ?? "")
    .split(",")
    .filter(Boolean)
    .map((id) => MOCK_PRODUCTS_BY_ID.get(id))
    .filter((part) => part !== undefined);

  if (build.length > 0) {
    const total = build.reduce((sum, part) => sum + part.pricePaise, 0);

    return (
      <div className="mx-auto w-full max-w-[640px] px-5 pt-14 pb-24 sm:px-8">
        <h1 className="font-display font-semibold text-[40px] text-bone leading-none tracking-[-0.03em]">
          Checkout
        </h1>

        <div className="mt-12 rounded-[20px] bg-panel p-7 shadow-card">
          <div className="flex items-baseline justify-between gap-6">
            <Label>Your build</Label>
            <span className="font-mono text-[13px] text-smoke tabular-nums">
              {build.length} parts
            </span>
          </div>

          <ul className="mt-5">
            {build.map((part) => (
              <li
                className="flex items-baseline justify-between gap-6 border-hairline border-t py-3"
                key={part.id}
              >
                <span className="min-w-0 truncate text-[15px] text-bone">
                  {part.name}
                </span>
                <span className="shrink-0 font-mono text-[15px] text-smoke tabular-nums">
                  {formatPaise(part.pricePaise)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-baseline justify-between gap-6 border-hairline border-t pt-5">
            <Label>Total</Label>
            <span className="font-mono text-[32px] text-bone tabular-nums">
              {formatPaise(total)}
            </span>
          </div>

          <Pill className="mt-7 w-full justify-center" disabled>
            Pay {formatPaise(total)}
          </Pill>

          <p className="mt-4 text-[13px] text-smoke">
            Payment wiring is the next step.
          </p>
        </div>
      </div>
    );
  }

  const cart = await getCart();
  const items = cart.lines.reduce((total, line) => total + line.quantity, 0);

  return (
    <div className="mx-auto w-full max-w-[640px] px-5 pt-14 pb-24 sm:px-8">
      <h1 className="font-display font-semibold text-[40px] text-bone leading-none tracking-[-0.03em]">
        Checkout
      </h1>

      <div className="mt-12 rounded-[20px] bg-panel p-7 shadow-card">
        <div className="flex items-baseline justify-between gap-6 py-2.5">
          <Label>Items</Label>
          <span className="font-mono text-[15px] text-bone tabular-nums">
            {items}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-6 py-2.5">
          <Label>Subtotal</Label>
          <span className="font-mono text-[15px] text-bone tabular-nums">
            {formatPaise(cart.subtotalPaise)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-6 py-2.5">
          <Label>Discount</Label>
          <span className="font-mono text-[15px] text-lacquer tabular-nums">
            −{formatPaise(cart.discountPaise)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-6 py-2.5">
          <Label>Tax</Label>
          <span className="font-mono text-[15px] text-bone tabular-nums">
            {formatPaise(cart.taxPaise)}
          </span>
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-6 border-hairline border-t pt-5">
          <Label>Total</Label>
          <span className="font-mono text-[32px] text-bone tabular-nums">
            {formatPaise(cart.totalPaise)}
          </span>
        </div>

        <Pill className="mt-7 w-full justify-center" disabled>
          Pay {formatPaise(cart.totalPaise)}
        </Pill>

        <p className="mt-4 text-[13px] text-smoke">
          Payment wiring is the next step.
        </p>
      </div>
    </div>
  );
}
