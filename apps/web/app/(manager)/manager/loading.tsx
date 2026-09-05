import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/**
 * The briefing's shape, held open.
 *
 * Three regions like the real screen — a fixed header, a scrolling middle, a
 * pinned composer — so the composer does not jump up the page when the numbers
 * land. A skeleton that is the wrong height is a second layout the reader has
 * to watch collapse.
 */

const TILES = ["earnings", "new", "due"];
const PANELS = ["selling", "not-selling", "never"];
const ROWS = ["a", "b", "c"];

function FigureTile() {
  return (
    <div className="rounded-[20px] border border-hairline bg-panel p-5">
      <Shimmer className="h-3 w-20" radius="pill" />
      <Shimmer className="mt-4 h-8 w-32" radius="pill" />
      <Shimmer className="mt-2 h-3 w-28" radius="pill" />
    </div>
  );
}

function ListPanel() {
  return (
    <div className="rounded-[20px] border border-hairline bg-panel p-5">
      <Shimmer className="h-3 w-24" radius="pill" />
      <div className="mt-4">
        {ROWS.map((row) => (
          <div className="flex items-center gap-3 py-3" key={row}>
            <Shimmer className="size-9 shrink-0" radius="ground" />
            <Shimmer className="h-4 flex-1" radius="pill" />
            <Shimmer className="h-4 w-12" radius="pill" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ManagerLoading() {
  return (
    <div className="flex h-[calc(100dvh-var(--manager-rail))] flex-col lg:h-dvh">
      <div className="shrink-0 px-5 pt-10 pb-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-[1180px] items-baseline justify-between gap-8">
          <Shimmer className="h-7 w-[360px] max-w-[70%]" radius="pill" />
          <Shimmer className="h-3 w-36" radius="pill" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-5 sm:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
          <div className="grid gap-4 sm:grid-cols-3">
            {TILES.map((tile) => (
              <FigureTile key={tile} />
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {PANELS.map((panel) => (
              <ListPanel key={panel} />
            ))}
          </div>

          <div className="mt-10">
            <Shimmer className="h-3 w-24" radius="pill" />
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ROWS.map((row) => (
                <div
                  className="rounded-[20px] border border-hairline bg-panel p-5"
                  key={row}
                >
                  <Shimmer className="h-4 w-[80%]" radius="pill" />
                  <Shimmer className="mt-3 h-4 w-[55%]" radius="pill" />
                  <Shimmer className="mt-5 h-3 w-20" radius="pill" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-hairline border-t bg-void px-5 py-4 sm:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
          <Shimmer className="h-[60px] w-full" radius="pill" />
        </div>
      </div>
    </div>
  );
}
