import type { CategorySlug } from "@workspace/db/taxonomy";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { cn } from "@workspace/ui/lib/utils";
import { ProductRender } from "@/components/common/product-render";
import type { PrebuiltDetail } from "@/lib/mock/types";

/**
 * One named feature, full-bleed, image on alternating sides.
 *
 * The heading comes from the data and is a real name — "Room to breathe",
 * "Cool under load". Nothing here is called "Features". Each section rests on
 * one measured fact, in mono, because a claim about a machine without a number
 * behind it is just an adjective.
 */

/** What each feature is illustrated with, in order. */
const DETAIL_RENDERS: CategorySlug[] = ["motherboard", "cooler", "psu"];

function FeatureBand({
  feature,
  index,
}: {
  feature: PrebuiltDetail["features"][number];
  index: number;
}) {
  const imageFirst = index % 2 === 0;

  return (
    <section
      className={cn(
        "w-full py-24 lg:py-28",
        imageFirst ? "bg-carbon" : "bg-void"
      )}
    >
      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-14 px-8 lg:grid-cols-2 lg:px-16">
        <ImageGround
          className={cn(
            "aspect-[4/3] p-14",
            imageFirst ? "lg:order-1" : "lg:order-2"
          )}
        >
          <ProductRender
            alt=""
            category={DETAIL_RENDERS[index % DETAIL_RENDERS.length] ?? "case"}
          />
        </ImageGround>

        <div className={cn(imageFirst ? "lg:order-2" : "lg:order-1")}>
          <h2 className="font-display font-medium text-[28px] text-bone uppercase leading-tight tracking-[0.05em]">
            {feature.heading}
          </h2>
          <p className="mt-6 max-w-[52ch] text-[17px] text-smoke">
            {feature.body}
          </p>
          <p className="mt-8 font-mono text-[13px] text-smoke tabular-nums">
            {feature.fact}
          </p>
        </div>
      </div>
    </section>
  );
}

export { FeatureBand };
