import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/** The catalogue grid, at the card dimensions it settles to. */
const CARDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pt-14 sm:px-8 lg:px-10 2xl:px-16">
      <Shimmer className="h-10 w-48" radius="pill" />
      <Shimmer className="mt-4 h-4 w-32" radius="pill" />

      <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <div key={card}>
            <Shimmer className="aspect-[4/3] w-full" radius="ground" />
            <Shimmer className="mt-4 h-4 w-3/4" radius="pill" />
            <Shimmer className="mt-2 h-3 w-1/2" radius="pill" />
            <Shimmer className="mt-3 h-4 w-24" radius="pill" />
          </div>
        ))}
      </div>
    </div>
  );
}
