import { Money } from "@/components/common/money";
import type { OrderLine } from "@/lib/queries/orders";

/** What was bought, at the prices the order was actually created with. */
export function OrderLines({
  currency,
  discountPaise,
  lines,
  subtotalPaise,
  totalPaise,
}: {
  currency?: string;
  discountPaise: number;
  lines: OrderLine[];
  subtotalPaise: number;
  totalPaise: number;
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {lines.map((line) => (
          <tr className="border-border/60 border-b" key={line.productId}>
            <td className="py-2 pr-2">
              {line.quantity} × {line.name ?? "Item"}
            </td>
            <td className="py-2 text-right">
              <Money currency={currency} paise={line.totalPaise} size="sm" />
            </td>
          </tr>
        ))}

        <tr>
          <td className="py-2 pr-2 text-muted-foreground">Subtotal</td>
          <td className="py-2 text-right">
            <Money currency={currency} paise={subtotalPaise} size="sm" />
          </td>
        </tr>

        {discountPaise > 0 ? (
          <tr className="text-verdant">
            <td className="py-1 pr-2">Discount</td>
            <td className="py-1 text-right tabular-nums">
              −<Money currency={currency} paise={discountPaise} size="sm" />
            </td>
          </tr>
        ) : null}

        <tr className="border-border border-t font-semibold">
          <td className="py-2 pr-2">Total</td>
          <td className="py-2 text-right">
            <Money currency={currency} paise={totalPaise} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
