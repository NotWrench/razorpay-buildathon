import type { CategorySlug } from "@workspace/db/taxonomy";
import { cn } from "@workspace/ui/lib/utils";
import { PhotoGround } from "@/components/common/photo-ground";
import type { PrebuiltDetail } from "@/lib/data/types";
import { featureImage } from "@/lib/landing-images";

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
  slug,
}: {
  feature: PrebuiltDetail["features"][number];
  index: number;
  slug: string;
}) {
  const imageFirst = index % 2 === 0;
  const art = featureImage(slug, index);

  return (
    <section
      className={cn(
        "w-full py-24 lg:py-28",
        imageFirst ? "bg-carbon" : "bg-void"
      )}
    >
      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-14 px-8 lg:grid-cols-2 lg:px-16">
        <PhotoGround
          alt=""
          category={DETAIL_RENDERS[index % DETAIL_RENDERS.length] ?? "case"}
          className={cn(
            "aspect-[4/3]",
            imageFirst ? "lg:order-1" : "lg:order-2"
          )}
          fallbackClassName="p-14"
          sizes="(min-width: 1024px) 50vw, 90vw"
          src={art?.src ?? undefined}
        />

        <div className={cn(imageFirst ? "lg:order-2" : "lg:order-1")}>
          <h2 className="t-model text-bone text-xl leading-tight">
            {feature.heading}
          </h2>
          <p className="t-body-lg mt-6 max-w-[52ch] text-smoke">
            {feature.body}
          </p>
          <p className="t-num-xs mt-8 text-smoke">{feature.fact}</p>
        </div>
      </div>
    </section>
  );
}

export { FeatureBand };
