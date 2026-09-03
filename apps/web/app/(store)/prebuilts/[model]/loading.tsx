import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/** The model page's shape: hero band, two feature bands, then the grid. */
export default function ModelLoading() {
  return (
    <div>
      <Shimmer className="h-[420px] w-full rounded-none" radius="ground" />

      <div className="mx-auto w-full max-w-[1280px] px-5 py-24 sm:px-8 lg:px-10 2xl:px-16">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Shimmer className="aspect-[4/3]" radius="ground" />
          <div>
            <Shimmer className="h-7 w-64" radius="pill" />
            <Shimmer className="mt-6 h-16 w-full" radius="pill" />
            <Shimmer className="mt-8 h-4 w-52" radius="pill" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10 2xl:px-16">
        <Shimmer className="h-3 w-24" radius="pill" />
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Shimmer className="aspect-[4/3]" radius="ground" />
          <Shimmer className="aspect-[4/3]" radius="ground" />
          <Shimmer className="aspect-[4/3]" radius="ground" />
        </div>
      </div>
    </div>
  );
}
