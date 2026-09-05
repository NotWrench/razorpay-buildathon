import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { PillLink } from "@/components/common/pill-link";
import { ProductRender } from "@/components/common/product-render";
import type { DockResult } from "@/lib/data/dock";
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
    <div className="mt-4 flex items-center gap-4 py-4">
      <ImageGround className="size-12 shrink-0 rounded-[12px] p-2">
        <ProductRender
          alt=""
          category={product.product.category}
          sizes="48px"
          src={product.product.imageUrl || undefined}
        />
      </ImageGround>
      <span className="t-body-sm min-w-0 flex-1 truncate text-bone">
        {product.product.name}
      </span>
      <span className="t-num-xs text-bone">
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
    <div className="mt-4">
      <div className="flex gap-3 py-3">
        <span className="w-20 shrink-0" />
        <span className="t-body-sm flex-1 truncate text-bone">
          {comparison.left.name}
        </span>
        <span className="t-body-sm flex-1 truncate text-bone">
          {comparison.right.name}
        </span>
      </div>
      {comparison.rows.map((row) => {
        const same = row.left === row.right;

        return (
          <div className="flex gap-3 py-3" key={row.label}>
            <Label className="w-20 shrink-0">{row.label}</Label>
            <span
              className={cn(
                "t-num-xs flex-1",
                same ? "text-smoke" : "text-bone"
              )}
            >
              {row.left}
            </span>
            <span
              className={cn(
                "t-num-xs flex-1",
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
    <div className="mt-4">
      {list.lines.map((line) => (
        <div className="flex items-center gap-3 py-3" key={line.product.id}>
          <ImageGround className="size-9 shrink-0 rounded-[10px] p-1.5">
            <ProductRender
              alt=""
              category={line.product.category}
              sizes="36px"
              src={line.product.imageUrl || undefined}
            />
          </ImageGround>
          <span className="t-body-sm min-w-0 flex-1 truncate text-smoke">
            {line.product.name}
          </span>
          <span className="t-num-xs text-smoke">×{line.quantity}</span>
        </div>
      ))}

      <div className="flex items-baseline justify-between gap-4 py-3">
        <Label>Total</Label>
        <span className="t-num-sm text-bone">
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
