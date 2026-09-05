import { Label } from "@workspace/ui/components/label";
import { CountUp } from "@workspace/ui/components/motion/count-up";
import { formatPaise } from "@workspace/ui/lib/money";
import { PillLink } from "@/components/common/pill-link";
import { shellRoutes } from "@/lib/routes";

/**
 * The summary. Sticky, because the decision it carries should not scroll away
 * from the list it is about.
 *
 * The total is **bone**, at 32px, counted up on every change. It is the most
 * important number on the page and it is still information, not an action —
 * the one red here is the Checkout pill.
 */

interface CartSummaryProps {
  discountPaise: number;
  shippingPaise: number;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
}

/**
 * Counting through paise means most intermediate frames are a fraction of a
 * rupee — ₹18,646.55 on the way to ₹4,37,780, which reads as a broken price
 * rather than a running total. Stepping in whole rupees keeps every frame a
 * plausible amount.
 */
const wholeRupees = (paise: number) =>
  formatPaise(Math.round(paise / 100) * 100);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <Label>{label}</Label>
      <span className="t-num-sm text-bone">{value}</span>
    </div>
  );
}

function CartSummary({
  discountPaise,
  shippingPaise,
  subtotalPaise,
  taxPaise,
  totalPaise,
}: CartSummaryProps) {
  return (
    <div className="surface-card rounded-[20px] bg-panel p-7 lg:sticky lg:top-[120px]">
      <Row label="Subtotal" value={formatPaise(subtotalPaise)} />

      {discountPaise > 0 ? (
        <div className="flex items-baseline justify-between gap-6 py-2.5">
          <Label>Discount</Label>
          <span className="t-num-sm text-ember">
            −{formatPaise(discountPaise)}
          </span>
        </div>
      ) : null}

      <Row
        label="Shipping"
        value={shippingPaise === 0 ? "Free" : formatPaise(shippingPaise)}
      />
      {taxPaise > 0 ? <Row label="Tax" value={formatPaise(taxPaise)} /> : null}

      <div className="mt-5 flex items-baseline justify-between gap-6 pt-5">
        <Label>Total</Label>
        <CountUp
          className="t-num-lg text-bone"
          format={wholeRupees}
          value={totalPaise}
        />
      </div>

      {/* Below lg the docked bar owns the Checkout, so the card hides its
          own — two solid reds on one screen is one too many. */}
      <PillLink
        className="mt-7 w-full justify-center max-lg:hidden"
        href={shellRoutes.checkout}
      >
        Checkout
      </PillLink>

      {/* Marks, not logos: naming the methods is honest, drawing somebody
          else's trademark on a demo is not. */}
      <Label className="mt-7 block opacity-40">
        UPI · Cards · Net banking · EMI
      </Label>
    </div>
  );
}

export { CartSummary };
