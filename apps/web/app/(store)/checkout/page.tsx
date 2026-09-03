import { Label } from "@workspace/ui/components/label";
import { formatPaise } from "@workspace/ui/lib/money";
import type { Metadata } from "next";
import { PayButton } from "@/components/checkout/pay-button";
import { getCart, getProductsByIds, requireDefaultStore } from "@/lib/data";

/**
 * Checkout.
 *
 * Two ways in. `?parts=` carries a selection the assistant assembled, and the
 * page prices exactly those lines — arriving here from the build sheet and
 * being shown the cart's total instead would be the app losing the thing you
 * just spent five minutes choosing. Without it, the cart.
 *
 * Both totals are what the gateway will actually take. `createCheckoutOrder`
 * charges `subtotal − discount`; there is no tax or shipping line, because
 * the catalogue is GST-inclusive Indian retail and the platform does not
 * charge for delivery. A summary that added either would be quoting a number
 * nobody is going to collect.
 */

export const metadata: Metadata = { title: "Checkout" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <Label>{label}</Label>
      <span className="font-mono text-[15px] text-bone tabular-nums">
        {value}
      </span>
    </div>
  );
}

function Total({ paise }: { paise: number }) {
  return (
    <div className="mt-5 flex items-baseline justify-between gap-6 border-hairline border-t pt-5">
      <Label>Total</Label>
      <span className="font-mono text-[32px] text-bone tabular-nums">
        {formatPaise(paise)}
      </span>
    </div>
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ parts?: string }>;
}) {
  const { parts } = await searchParams;
  const merchant = await requireDefaultStore();

  const wanted = (parts ?? "").split(",").filter(Boolean);
  const build = wanted.length > 0 ? await getProductsByIds(wanted) : [];

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

          <Total paise={total} />

          <PayButton
            parts={build.map((part) => part.id)}
            storeName={merchant.businessName}
            totalPaise={total}
          />
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
        <Row label="Items" value={String(items)} />
        <Row label="Subtotal" value={formatPaise(cart.subtotalPaise)} />

        {cart.discountPaise > 0 ? (
          <div className="flex items-baseline justify-between gap-6 py-2.5">
            <Label>Discount</Label>
            <span className="font-mono text-[15px] text-lacquer tabular-nums">
              −{formatPaise(cart.discountPaise)}
            </span>
          </div>
        ) : null}

        <Total paise={cart.totalPaise} />

        {items === 0 ? (
          <p className="mt-7 text-[15px] text-smoke">
            There is nothing in your cart to pay for yet.
          </p>
        ) : (
          <PayButton
            storeName={merchant.businessName}
            totalPaise={cart.totalPaise}
          />
        )}
      </div>
    </div>
  );
}
