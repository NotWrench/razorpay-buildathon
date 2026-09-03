import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/**
 * The briefing's shape, held open.
 *
 * Every measurement here matches the real block — a 48px earnings figure, three
 * 66px rows per product block, three findings — so nothing moves when the
 * numbers arrive. A skeleton that is the wrong height is a second layout the
 * reader has to watch collapse.
 */

const ROWS = ["a", "b", "c"];

function RowBlock() {
  return (
    <div>
      <Shimmer className="h-3 w-28" radius="pill" />
      <div className="mt-5 border-hairline border-t">
        {ROWS.map((row) => (
          <div
            className="flex items-center gap-4 border-hairline border-b py-4"
            key={row}
          >
            <Shimmer className="size-10 shrink-0" radius="ground" />
            <Shimmer className="h-4 flex-1" radius="pill" />
            <Shimmer className="h-4 w-24" radius="pill" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ManagerLoading() {
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pt-16 pb-10 sm:px-8">
      <Shimmer className="h-8 w-[420px]" radius="pill" />
      <Shimmer className="mt-4 h-3 w-40" radius="pill" />

      <div className="mt-14 grid gap-14">
        <div>
          <Shimmer className="h-3 w-20" radius="pill" />
          <Shimmer className="mt-5 h-12 w-64" radius="pill" />
          <Shimmer className="mt-3 h-3 w-56" radius="pill" />
        </div>

        <div>
          <Shimmer className="h-3 w-16" radius="pill" />
          <div className="mt-5 flex gap-20">
            <div>
              <Shimmer className="h-3 w-10" radius="pill" />
              <Shimmer className="mt-2 h-7 w-16" radius="pill" />
            </div>
            <div>
              <Shimmer className="h-3 w-10" radius="pill" />
              <Shimmer className="mt-2 h-7 w-16" radius="pill" />
            </div>
          </div>
        </div>

        <RowBlock />
        <RowBlock />
        <RowBlock />

        <div>
          <Shimmer className="h-3 w-24" radius="pill" />
          <div className="mt-5 border-hairline border-t">
            {ROWS.map((row) => (
              <div className="border-hairline border-b py-7" key={row}>
                <Shimmer className="h-4 w-[60%]" radius="pill" />
                <Shimmer className="mt-2 h-4 w-[40%]" radius="pill" />
                <Shimmer className="mt-4 h-3 w-20" radius="pill" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <Shimmer className="mt-14 h-[60px] w-full" radius="pill" />
    </div>
  );
}
