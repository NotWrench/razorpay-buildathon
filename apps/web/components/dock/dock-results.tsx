import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { PillLink } from "@/components/common/pill-link";
import { ProductRender } from "@/components/common/product-render";
import type { DockResult } from "@/lib/mock/chat";
import { route } from "@/lib/routes";

/**
 * What a dock answer looks like when it is more than a sentence.
 *
 * Three shapes, matching the three jobs. Nothing here edits anything — the
 * dock is read-only by design, and a checkbox in this panel would be the first
 * step towards it quietly becoming a second cart.
 */

function ProductRow({
  product,
}: {
  product: DockResult & { kind: "product" };
}) {
  return (
    <div className="mt-4 flex items-center gap-4 border-hairline border-t border-b py-4">
      <ImageGround className="size-12 shrink-0 rounded-[12px] p-2">
        <ProductRender alt="" category={product.product.category} />
      </ImageGround>
      <span className="min-w-0 flex-1 truncate text-[13px] text-bone">
        {product.product.name}
      </span>
      <span className="font-mono text-[13px] text-bone tabular-nums">
        {formatPaise(product.product.pricePaise)}
      </span>
    </div>
  );
}

/**
 * Rows where the two parts agree go smoke; rows where they differ stay bone,
 * so the eye lands on the difference rather than reading the whole table.
 */
function ComparisonTable({
  comparison,
}: {
  comparison: DockResult & { kind: "comparison" };
}) {
  return (
    <div className="mt-4 border-hairline border-t">
      <div className="flex gap-3 border-hairline border-b py-3">
        <span className="w-20 shrink-0" />
        <span className="flex-1 truncate text-[13px] text-bone">
          {comparison.left.name}
        </span>
        <span className="flex-1 truncate text-[13px] text-bone">
          {comparison.right.name}
        </span>
      </div>
      {comparison.rows.map((row) => {
        const same = row.left === row.right;

        return (
          <div
            className="flex gap-3 border-hairline border-b py-2.5"
            key={row.label}
          >
            <Label className="w-20 shrink-0">{row.label}</Label>
            <span
              className={cn(
                "flex-1 font-mono text-[13px] tabular-nums",
                same ? "text-smoke" : "text-bone"
              )}
            >
              {row.left}
            </span>
            <span
              className={cn(
                "flex-1 font-mono text-[13px] tabular-nums",
                same ? "text-smoke" : "text-bone"
              )}
            >
              {row.right}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ListResult({ list }: { list: DockResult & { kind: "list" } }) {
  return (
    <div className="mt-4 border-hairline border-t">
      {list.lines.map((line) => (
        <div
          className="flex items-center gap-3 border-hairline border-b py-2.5"
          key={line.product.id}
        >
          <ImageGround className="size-9 shrink-0 rounded-[10px] p-1.5">
            <ProductRender alt="" category={line.product.category} />
          </ImageGround>
          <span className="min-w-0 flex-1 truncate text-[13px] text-smoke">
            {line.product.name}
          </span>
          <span className="font-mono text-[13px] text-smoke tabular-nums">
            ×{line.quantity}
          </span>
        </div>
      ))}

      <div className="flex items-baseline justify-between gap-4 py-3">
        <Label>Total</Label>
        <span className="font-mono text-[15px] text-bone tabular-nums">
          {formatPaise(list.totalPaise)}
        </span>
      </div>

      <PillLink className="px-0" href={route("/assistant")} variant="text">
        Open full builder →
      </PillLink>
    </div>
  );
}

function DockResultView({ result }: { result: DockResult }) {
  if (result.kind === "product") {
    return <ProductRow product={result} />;
  }

  if (result.kind === "comparison") {
    return <ComparisonTable comparison={result} />;
  }

  if (result.kind === "list") {
    return <ListResult list={result} />;
  }

  return null;
}

export { DockResultView };
