"use client";

import { formatPaise } from "@/lib/format";
import {
  FailureCard,
  OrderCard,
  PaymentLinkCard,
  ProductGrid,
  QuoteCard,
  RecommendationCard,
} from "../cards";
import { ToolCard } from "../primitives";
import type { ToolPartShape } from "../tool-part";
import { BuildCheckCard } from "./build-check-card";
import { CartCard } from "./cart-card";

/**
 * A finished storefront tool call, as a card.
 *
 * Anything involving money, compatibility or stock gets a card rather than a
 * paragraph: a total or a blocking incompatibility buried in prose is one
 * nobody checks. Tools whose output the agent simply narrates render nothing.
 */

/* biome-ignore lint/suspicious/noExplicitAny: tool outputs are a wide union narrowed per case. */
type Output = any;

export interface StorefrontOutputHandlers {
  onPay: (
    checkout: {
      amount: number;
      currency: string;
      keyId: string;
      razorpayOrderId: string;
    },
    orderId: string
  ) => void;
  onSend: (text: string) => void;
  payingOrder: string | null;
  slug: string;
}

export function StorefrontToolOutput({
  handlers,
  part,
}: {
  handlers: StorefrontOutputHandlers;
  part: ToolPartShape;
}) {
  const output = part.output as Output;
  const input = part.input as Output;

  switch (part.type) {
    case "tool-searchProducts":
      return (
        <ProductGrid
          note={
            output.strategy === "lexical" ? "Matched on keywords." : undefined
          }
          products={output.products ?? []}
          title="From the catalog"
        />
      );

    case "tool-suggestUpsell":
      return (
        <ProductGrid
          note={output.note}
          products={output.suggestions ?? []}
          title="Often bought together"
        />
      );

    case "tool-recommendProducts":
      // The reasons and confidences live on the tool's input, not its output —
      // the output only confirms how many were written to the record.
      return (
        <RecommendationCard recommendations={input?.recommendations ?? []} />
      );

    case "tool-compareProducts":
      return <ComparisonCard comparison={output} />;

    case "tool-checkBuildCompatibility":
    case "tool-getBuild":
    case "tool-createBuild":
    case "tool-updateBuild":
      // The builder tools return the validation flattened onto the result,
      // so the card reads the output itself rather than a nested field.
      return <BuildCheckCard slug={handlers.slug} validation={output} />;

    case "tool-getCart":
    case "tool-addToCart":
    case "tool-removeFromCart":
    case "tool-addBuildToCart":
      return <CartCard cart={output} slug={handlers.slug} />;

    case "tool-quoteOrder":
      return <QuoteCard quote={output} />;

    case "tool-createOrder":
      return (
        <OrderCard
          approvalStatus={output.approvalStatus}
          breakdown={output.breakdown}
          message={output.message}
          onPay={
            output.checkout
              ? () => handlers.onPay(output.checkout, output.orderId)
              : undefined
          }
          orderId={output.orderId}
          payable={
            Boolean(output.checkout) && handlers.payingOrder !== output.orderId
          }
          totalPaise={output.totalPaise}
        />
      );

    case "tool-createPaymentLink":
      return (
        <PaymentLinkCard message={output.message} url={output.paymentLinkUrl} />
      );

    case "tool-getOrderStatus":
      if (output.paymentStatus === "failed") {
        return (
          <FailureCard
            failureReason={output.failureReason}
            onOption={(option) => handlers.onSend(`Let's ${option}.`)}
            options={output.recoveryOptions ?? []}
          />
        );
      }

      return (
        <ToolCard title="Order status">
          <p>
            {output.orderStatus} · {output.approvalStatus} ·{" "}
            {formatPaise(output.totalPaise)}
          </p>
        </ToolCard>
      );

    case "tool-cancelOrder":
      return (
        <ToolCard title="Cancelled">
          <p className="text-muted-foreground">{output.message}</p>
        </ToolCard>
      );

    default:
      return null;
  }
}

/** Attribute-by-attribute, as the compare tool returns it. */
function ComparisonCard({ comparison }: { comparison: Output }) {
  const rows: Output[] = comparison.matrix ?? [];
  const names: string[] = comparison.products?.map((p: Output) => p.name) ?? [];

  if (rows.length === 0) {
    return null;
  }

  return (
    <ToolCard title="Side by side">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="py-1 pr-3 font-medium">Attribute</th>
              {names.map((name) => (
                <th className="py-1 pr-3 font-medium" key={name}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-border/50 border-t" key={row.label}>
                <td className="py-1 pr-3 text-muted-foreground">{row.label}</td>
                {(row.cells ?? []).map((cell: Output, index: number) => (
                  <td
                    className="py-1 pr-3 tabular-nums"
                    key={`${row.label}-${names[index] ?? index}`}
                  >
                    {cell.value ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ToolCard>
  );
}
