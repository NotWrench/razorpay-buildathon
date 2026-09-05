import { Shimmer } from "@workspace/ui/components/motion/shimmer";

const SLOTS = ["cpu", "motherboard", "ram", "gpu", "storage", "psu"];

/** The builder's shape: the slot column on the left, the total rail beside it. */
export default function BuildLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16 2xl:px-16">
      <Shimmer className="h-3 w-24" radius="pill" />
      <Shimmer className="mt-4 h-12 w-[420px] max-w-full" radius="pill" />
      <Shimmer className="mt-5 h-4 w-[520px] max-w-full" radius="pill" />

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_360px] lg:items-start">
        <div>
          {SLOTS.map((slot) => (
   <div className="py-6"key={slot}>
              <Shimmer className="h-3 w-24" radius="pill" />
              <Shimmer className="mt-4 h-[76px] w-full" radius="ground" />
            </div>
          ))}
        </div>
        <Shimmer className="h-[380px] w-full" radius="card" />
      </div>
    </div>
  );
}
