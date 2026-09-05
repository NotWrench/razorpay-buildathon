"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { CountUp } from "@workspace/ui/components/motion/count-up";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductRender } from "@/components/common/product-render";
import { TrendLine } from "@/components/manager/trend-line";
import type {
  ManagerSummary,
  NeverSeenRow,
  ProductSummary,
  SeenNotBoughtRow,
  SellingRow,
} from "@/lib/data/types";
import { managerRoutes } from "@/lib/routes";

/**
 * The reading blocks of the summary.
 *
 * These used to be six full-width blocks stacked 56px apart, which meant the
 * composer underneath them started three screens down and the operator had to
 * scroll past the whole briefing to ask about any of it. They are panels now:
 * the two figures and the three product lists each hold a column, and the
 * whole briefing fits in one view.
 *
 * The values are unchanged. Nothing here computes anything the server did not
 * already send.
 */

/** Money counts in whole rupees; paise frames read as a broken price. */
const wholeRupees = (paise: number) =>
  formatPaise(Math.round(paise / 100) * 100);

const PANEL =
  "rounded-[20px] border border-hairline bg-panel p-5 transition-colors duration-micro";

/** A titled panel. The heading is the label; the panel is the block. */
function Panel({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section className={cn(PANEL, className)}>
      <Label>{title}</Label>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * A product line inside a panel.
 *
 * Denser than the old full-width row — 12px rather than 16px — because three
 * of these columns now share the width one of them used to have.
 */
function Row({
  product,
  right,
}: {
  product: ProductSummary;
  right: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <ImageGround className="size-9 shrink-0 rounded-[10px] p-1.5">
        <ProductRender
          alt=""
          category={product.category}
          sizes="36px"
          src={product.imageUrl || undefined}
        />
      </ImageGround>

      <p className="t-body-sm min-w-0 flex-1 truncate text-bone">
        {product.name}
      </p>

      <div className="flex shrink-0 items-center gap-3">{right}</div>
    </div>
  );
}

/** A panel with nothing in it says so, rather than showing a bare heading. */
function Nothing() {
  return <p className="t-body-sm py-3 text-smoke">Nothing in this window.</p>;
}

function Earnings({ summary }: { summary: ManagerSummary }) {
  const rising = summary.earningsDeltaPercent >= 0;

  return (
    <section className={PANEL}>
      <Label>Earnings</Label>
      <CountUp
        className="t-num-lg mt-4 block text-2xl text-bone"
        format={wholeRupees}
        value={summary.earningsPaise}
      />
      <p className="t-body-sm mt-2 text-smoke">
        <span className="font-mono tabular-nums">
          {rising ? "▲" : "▼"} {Math.abs(summary.earningsDeltaPercent)}%
        </span>{" "}
        vs {summary.range.previous}
      </p>
    </section>
  );
}

/**
 * One order figure, and the whole tile is the link.
 *
 * A number you can press should look pressable across its whole face, not
 * only under the four characters of the number itself.
 */
function OrderFigure({ count, title }: { count: number; title: string }) {
  return (
    <Link
      className={cn(
        PANEL,
        "group block outline-none hover:border-smoke focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-[3px]"
      )}
      href={managerRoutes.orders}
    >
      <span className="flex items-center justify-between">
        <Label>{title}</Label>
        <ArrowUpRight
          aria-hidden
          className="size-4 text-smoke transition-colors duration-micro group-hover:text-bone"
        />
      </span>
      <CountUp
        className="t-num-lg mt-4 block text-2xl text-bone"
        value={count}
      />
      <span className="t-body-sm mt-2 block text-smoke">in this window</span>
    </Link>
  );
}

function Orders({ summary }: { summary: ManagerSummary }) {
  return (
    <>
      <OrderFigure count={summary.newOrders} title="New orders" />
      <OrderFigure count={summary.dueOrders} title="Due orders" />
    </>
  );
}

function SellingWell({ rows }: { rows: SellingRow[] }) {
  return (
    <Panel title="Selling well">
      {rows.length === 0 ? (
        <Nothing />
      ) : (
        rows.map((row) => (
          <Row
            key={row.product.id}
            product={row.product}
            right={
              <>
                <span className="t-num-sm text-bone">{row.units}</span>
                <TrendLine points={row.trend} />
              </>
            }
          />
        ))
      )}
    </Panel>
  );
}

function SeenNotBought({ rows }: { rows: SeenNotBoughtRow[] }) {
  return (
    <Panel title="Not selling">
      {rows.length === 0 ? (
        <Nothing />
      ) : (
        rows.map((row) => (
          <Row
            key={row.product.id}
            product={row.product}
            right={
              /* The one pairing on this page a merchant cannot get anywhere
                 else, so it is the one that gets colour. */
              <span className="t-num-xs text-amber">
                {row.carted} carted · {row.sold} sold
              </span>
            }
          />
        ))
      )}
    </Panel>
  );
}

function NeverSeen({ rows }: { rows: NeverSeenRow[] }) {
  return (
    <Panel title="Never ordered">
      {rows.length === 0 ? (
        <Nothing />
      ) : (
        rows.map((row) => (
          <Row
            key={row.product.id}
            product={row.product}
            right={
              <span className="t-num-xs text-smoke">
                {row.listedDaysAgo}d listed
              </span>
            }
          />
        ))
      )}
    </Panel>
  );
}

export { Earnings, NeverSeen, Orders, SeenNotBought, SellingWell };
