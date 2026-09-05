import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/**
 * A manager table, held open at its real dimensions.
 *
 * The row height matches `ManagerTable`'s — 12px padding around a 44px cell —
 * so the rows do not move when the data lands. A skeleton that is the wrong
 * height is a second layout the reader has to watch collapse.
 */

const ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"];

function ManagerTableSkeleton({
  columns = 5,
  rows = 8,
  title = "w-[180px]",
}: {
  columns?: number;
  rows?: number;
  /** Width class for the heading block. */
  title?: string;
}) {
  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <div className="flex items-center justify-between pb-8">
        <Shimmer className={`h-8 ${title}`} radius="pill" />
        <Shimmer className="h-9 w-32" radius="pill" />
      </div>

      <div>
        <div className="flex gap-5 px-3 py-2.5">
          {Array.from({ length: columns }, (_, index) => (
            <Shimmer
              className="h-3 w-16"
              // biome-ignore lint/suspicious/noArrayIndexKey: the columns are positions, not data
              key={index}
              radius="pill"
            />
          ))}
        </div>

        {ROWS.slice(0, rows).map((row) => (
          <div className="flex items-center gap-5 px-3 py-3" key={row}>
            <Shimmer className="size-11 shrink-0" radius="ground" />
            <Shimmer className="h-4 flex-1" radius="pill" />
            <Shimmer className="h-4 w-24" radius="pill" />
            <Shimmer className="h-4 w-16" radius="pill" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The catalogue's grid, held open.
 *
 * Eight cards at the card's real proportions — a 4:3 ground, two lines of
 * name, a price and a stock figure — so the grid does not reflow when the
 * products land.
 */
function ProductGridSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <div className="flex flex-wrap items-center justify-between gap-6 pb-8">
        <Shimmer className="h-8 w-[180px]" radius="pill" />
        <div className="flex flex-wrap items-center gap-4">
          <Shimmer className="h-9 w-[240px]" radius="pill" />
          <Shimmer className="h-9 w-24" radius="pill" />
          <Shimmer className="h-9 w-28" radius="pill" />
          <Shimmer className="h-9 w-32" radius="pill" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {ROWS.slice(0, cards).map((card) => (
          <div
            className="rounded-[20px] border border-hairline bg-panel p-3"
            key={card}
          >
            <Shimmer className="aspect-[4/3] w-full" radius="ground" />
            <div className="px-1.5 pt-4">
              <Shimmer className="h-4 w-[85%]" radius="pill" />
              <Shimmer className="mt-2 h-3 w-16" radius="pill" />
              <div className="flex items-center justify-between gap-3 pt-4">
                <Shimmer className="h-5 w-24" radius="pill" />
                <Shimmer className="h-3 w-20" radius="pill" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { ManagerTableSkeleton, ProductGridSkeleton };
