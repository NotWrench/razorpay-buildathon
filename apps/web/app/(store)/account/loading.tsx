import { Shimmer } from "@workspace/ui/components/motion/shimmer";

/** The profile's five blocks, at the heights they settle to. */
const ROWS = ["a", "b", "c", "d"];

export default function Loading() {
  return (
    <div className="grid gap-24">
      <div>
        <Shimmer className="h-7 w-56" radius="pill" />
        <Shimmer className="mt-4 h-4 w-40" radius="pill" />
        <Shimmer className="mt-2 h-3 w-48" radius="pill" />
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
        {ROWS.map((row) => (
          <div key={row}>
            <Shimmer className="h-3 w-20" radius="pill" />
            <Shimmer className="mt-3 h-8 w-24" radius="pill" />
          </div>
        ))}
      </div>

      <div>
        <Shimmer className="h-3 w-28" radius="pill" />
        <div className="mt-6 border-hairline border-t">
          {ROWS.map((row) => (
            <div
              className="flex items-center gap-6 border-hairline border-b py-5"
              key={row}
            >
              <Shimmer className="h-4 w-28" radius="pill" />
              <Shimmer className="h-3 w-24" radius="pill" />
              <Shimmer className="h-3 flex-1" radius="pill" />
              <Shimmer className="h-4 w-24" radius="pill" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
