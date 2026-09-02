import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/**
 * The product page's shape, before it has anything in it.
 *
 * Built to the real layout — the same grid, the same sticky gallery block, the
 * same row heights on the right — so the page does not jump when the content
 * lands.
 */
export default function ProductLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pt-14 sm:px-8 lg:px-10 2xl:px-16">
      <div className="grid gap-14 lg:grid-cols-[55%_1fr]">
        <div>
          <Shimmer className="aspect-[4/3] rounded-[20px]" radius="card" />
          <div className="mt-5 flex gap-4">
            <Shimmer className="size-[72px]" radius="ground" />
            <Shimmer className="size-[72px]" radius="ground" />
            <Shimmer className="size-[72px]" radius="ground" />
            <Shimmer className="size-[72px]" radius="ground" />
          </div>
        </div>

        <div>
          <Shimmer className="h-3 w-20" radius="pill" />
          <Shimmer className="mt-4 h-8 w-4/5" radius="pill" />
          <Shimmer className="mt-7 h-8 w-56" radius="pill" />
          <Shimmer className="mt-8 h-11 w-48" radius="pill" />
          <div className="mt-8 flex gap-4">
            <Shimmer className="h-11 w-40" radius="pill" />
            <Shimmer className="h-11 w-40" radius="pill" />
          </div>
          <div className="mt-8 border-hairline border-t border-b py-6">
            <Shimmer className="h-3 w-28" radius="pill" />
            <Shimmer className="mt-4 h-5 w-64" radius="pill" />
            <Shimmer className="mt-3 h-4 w-full" radius="pill" />
          </div>
          <Shimmer className="mt-8 h-16 w-full" radius="pill" />
        </div>
      </div>
    </div>
  );
}
