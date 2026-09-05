import { Shimmer } from "@workspace/ui/components/motion/shimmer";

const ROWS = ["a", "b", "c", "d", "e"];

/** The cart's shape: the list on the left, the summary card on the right. */
export default function CartLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pt-14 sm:px-8 lg:px-10 2xl:px-16">
      <Shimmer className="h-10 w-32" radius="pill" />

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_380px]">
        <div>
          {ROWS.map((row) => (
            <div className="flex items-center gap-5 py-6" key={row}>
              <Shimmer className="size-[72px] shrink-0" radius="ground" />
              <div className="flex-1">
                <Shimmer className="h-4 w-64" radius="pill" />
                <Shimmer className="mt-2 h-3 w-20" radius="pill" />
              </div>
              <Shimmer className="h-10 w-28" radius="pill" />
              <Shimmer className="h-4 w-24" radius="pill" />
            </div>
          ))}
        </div>
        <Shimmer className="h-[420px] w-full" radius="card" />
      </div>
    </div>
  );
}
