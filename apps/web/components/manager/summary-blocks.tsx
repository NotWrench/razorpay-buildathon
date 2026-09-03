"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { CountUp } from "@workspace/ui/components/motion/count-up";
import { formatPaise } from "@workspace/ui/lib/money";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { PillLink } from "@/components/common/pill-link";
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
 * The five reading blocks of the summary.
 *
 * No tiles, no KPI row, no bar chart. Each block is a label and then the thing
 * itself — one figure, two figures, or three rows on hairlines. The moment
 * these become cards they stop being a briefing and start being a dashboard,
 * which is the screen this page exists instead of.
 */

/** Money counts in whole rupees; paise frames read as a broken price. */
const wholeRupees = (paise: number) =>
  formatPaise(Math.round(paise / 100) * 100);

function Block({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <Label>{title}</Label>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({
  product,
  right,
}: {
  product: ProductSummary;
  right: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-hairline border-b py-4">
      <ImageGround className="size-10 shrink-0 rounded-[12px] p-1.5">
        <ProductRender
          alt=""
          category={product.category}
          sizes="40px"
          src={product.imageUrl || undefined}
        />
      </ImageGround>

      <p className="min-w-0 flex-1 truncate text-[15px] text-bone">
        {product.name}
      </p>

      <div className="flex shrink-0 items-center gap-5">{right}</div>
    </div>
  );
}

function Earnings({ summary }: { summary: ManagerSummary }) {
  const rising = summary.earningsDeltaPercent >= 0;

  return (
    <Block title="Earnings">
      <CountUp
        className="text-[48px] text-bone"
        format={wholeRupees}
        value={summary.earningsPaise}
      />
      <p className="mt-2 text-[13px] text-smoke">
        <span className="font-mono tabular-nums">
          {rising ? "▲" : "▼"} {Math.abs(summary.earningsDeltaPercent)}%
        </span>{" "}
        vs {summary.range.previous}
      </p>
    </Block>
  );
}

function OrderFigure({ count, title }: { count: number; title: string }) {
  return (
    <PillLink
      className="group h-auto justify-start px-0 hover:bg-transparent"
      href={managerRoutes.orders}
      variant="text"
    >
      <span className="block">
        <Label className="block">{title}</Label>
        <span className="mt-2 flex items-center gap-2">
          <CountUp className="text-[28px] text-bone" value={count} />
          <ArrowUpRight
            aria-hidden
            className="size-4 text-smoke transition-colors duration-[180ms] group-hover:text-bone"
          />
        </span>
      </span>
    </PillLink>
  );
}

function Orders({ summary }: { summary: ManagerSummary }) {
  return (
    <Block title="Orders">
      <div className="flex gap-20">
        <OrderFigure count={summary.newOrders} title="New" />
        <OrderFigure count={summary.dueOrders} title="Due" />
      </div>
    </Block>
  );
}

function SellingWell({ rows }: { rows: SellingRow[] }) {
  return (
    <Block title="Selling well">
      <div className="border-hairline border-t">
        {rows.map((row) => (
          <Row
            key={row.product.id}
            product={row.product}
            right={
              <>
                <span className="font-mono text-[15px] text-bone tabular-nums">
                  {row.units}
                </span>
                <TrendLine points={row.trend} />
              </>
            }
          />
        ))}
      </div>
    </Block>
  );
}

function SeenNotBought({ rows }: { rows: SeenNotBoughtRow[] }) {
  return (
    <Block title="Not selling">
      <div className="border-hairline border-t">
        {rows.map((row) => (
          <Row
            key={row.product.id}
            product={row.product}
            right={
              /* The one pairing on this page a merchant cannot get anywhere
                 else, so it is the one that gets colour. */
              <span className="font-mono text-[13px] text-amber tabular-nums">
                {row.carted} carted · {row.sold} sold
              </span>
            }
          />
        ))}
      </div>
    </Block>
  );
}

function NeverSeen({ rows }: { rows: NeverSeenRow[] }) {
  return (
    <Block title="Never ordered">
      <div className="border-hairline border-t">
        {rows.map((row) => (
          <Row
            key={row.product.id}
            product={row.product}
            right={
              <span className="font-mono text-[13px] text-smoke tabular-nums">
                listed {row.listedDaysAgo} days ago
              </span>
            }
          />
        ))}
      </div>
    </Block>
  );
}

export { Earnings, NeverSeen, Orders, SeenNotBought, SellingWell };
