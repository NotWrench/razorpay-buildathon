import { Reveal } from "@workspace/ui/components/motion/reveal";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeatureBand } from "@/components/prebuilt/feature-band";
import { FullSpecs } from "@/components/prebuilt/full-specs";
import { ManifestTable } from "@/components/prebuilt/manifest-table";
import { ModelGallery } from "@/components/prebuilt/model-gallery";
import { ModelHero } from "@/components/prebuilt/model-hero";
import { getPrebuilt } from "@/lib/mock";

/**
 * One machine, the NEURON pattern: hero, named feature sections, gallery,
 * what's inside, and only then the exhaustive table.
 *
 * Marketing first, specifications last — someone deciding between machines is
 * not reading a spec sheet yet, and someone who is can scroll.
 */

type Params = Promise<{ model: string }>;

/** 128px, stepping down at 1024 and 768. */
const SECTION = "mt-16 md:mt-[88px] lg:mt-32";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { model } = await params;
  const machine = await getPrebuilt(model);

  return {
    description: machine?.tagline,
    title: machine ? `${machine.name} — ${machine.tagline}` : "Prebuilt",
  };
}

export default async function ModelPage({ params }: { params: Params }) {
  const { model } = await params;
  const machine = await getPrebuilt(model);

  if (!machine) {
    notFound();
  }

  return (
    <div>
      <ModelHero machine={machine} />

      {machine.features.map((feature, index) => (
        <FeatureBand feature={feature} index={index} key={feature.heading} />
      ))}

      <Reveal className={SECTION}>
        <ModelGallery name={machine.name} views={machine.images} />
      </Reveal>

      <Reveal className={SECTION}>
        <ManifestTable machine={machine} />
      </Reveal>

      <Reveal className={SECTION}>
        <FullSpecs machine={machine} />
      </Reveal>
    </div>
  );
}
