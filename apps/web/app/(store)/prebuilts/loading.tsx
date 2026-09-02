import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/** The listing's shape: the band, the filter row, then two tall rows. */
export default function PrebuiltsLoading() {
  return (
    <div>
      <Shimmer
        className="h-[280px] w-full rounded-none lg:h-[320px]"
        radius="ground"
      />

      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10 2xl:px-16">
        <div className="relative -mt-20">
          <Shimmer className="h-10 w-80" radius="pill" />
          <Shimmer className="mt-5 h-4 w-96" radius="pill" />
        </div>

        <div className="mt-10 flex gap-3">
          <Shimmer className="h-11 w-20" radius="pill" />
          <Shimmer className="h-11 w-28" radius="pill" />
          <Shimmer className="h-11 w-28" radius="pill" />
          <Shimmer className="h-11 w-36" radius="pill" />
        </div>

        <div className="mt-12 space-y-8 border-hairline border-t pt-8">
          <div className="grid gap-9 lg:grid-cols-[44%_1fr]">
            <Shimmer className="aspect-[4/3]" radius="ground" />
            <div>
              <Shimmer className="h-7 w-48" radius="pill" />
              <Shimmer className="mt-4 h-4 w-72" radius="pill" />
              <Shimmer className="mt-6 h-7 w-56" radius="pill" />
              <Shimmer className="mt-8 h-32 w-full" radius="pill" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
