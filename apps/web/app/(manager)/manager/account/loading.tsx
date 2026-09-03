import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/** Four sections on hairlines, at the heights they settle to. */
const SECTIONS = ["a", "b", "c", "d"];

export default function Loading() {
  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <Shimmer className="h-8 w-[200px]" radius="pill" />

      <div className="mt-14 max-w-[640px]">
        {SECTIONS.map((section, index) => (
          <div
            className={
              index === 0 ? "" : "mt-12 border-hairline border-t pt-12"
            }
            key={section}
          >
            <Shimmer className="h-3 w-28" radius="pill" />
            <div className="mt-6 grid gap-5">
              <Shimmer className="h-[52px] w-full" radius="pill" />
              <Shimmer className="h-[52px] w-full" radius="pill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
