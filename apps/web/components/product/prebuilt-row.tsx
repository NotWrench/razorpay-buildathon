import { Label } from "@workspace/ui/components/label";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { SpecList } from "@workspace/ui/components/spec-list";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { PhotoGround } from "@/components/common/photo-ground";
import { PillLink } from "@/components/common/pill-link";
import type { PrebuiltSummary } from "@/lib/data/types";
import { machineImage } from "@/lib/landing-images";
import { shellRoutes } from "@/lib/routes";

/**
 * ORIGIN's listing pattern: one machine per row, given enough room to decide
 * from — render, name, positioning line, price, colourways, four labelled
 * specs and three actions.
 *
 * `primary` is a page-level decision, not a property of the machine. Only one
 * row on a page gets the filled pill, because a column of red buttons is how
 * the red stops meaning anything.
 */
interface PrebuiltRowProps {
  prebuilt: PrebuiltSummary;
  primary?: boolean;
}

function PrebuiltRow({ prebuilt, primary = false }: PrebuiltRowProps) {
  const href = shellRoutes.prebuilt(prebuilt.slug);

  return (
    <article className="group grid gap-9 py-8 transition-transform duration-micro hover:-translate-y-0.5 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-center">
      {/*
        A 300px track, not the 44% this row used to give the picture.

        The machine shots are 2:3, and a 2:3 image in a 528px column is 792px
        tall standing next to 377px of text — four rows of that took the listing
        from 1840px to 3424px, most of it blank. At 300px the image is 450px, the
        text is 377px, and `items-center` splits the remaining slack above and
        below instead of pooling it under the buttons.

        `items-center` also makes the ratio real: a stretched grid item has a
        definite height, and `aspect-*` on one is silently ignored.
      */}
      <PhotoGround
        alt={`${prebuilt.name} tower`}
        category="case"
        className="aspect-[2/3]"
        fallbackClassName="p-10"
        imageClassName="transition-transform duration-standard group-hover:scale-[1.03]"
        sizes="(min-width: 1024px) 300px, 90vw"
        src={machineImage(prebuilt.slug)}
      />

      <div className="flex flex-col">
        <Link href={href}>
          <h3 className="t-model text-bone text-xl leading-none">
            {prebuilt.name}
          </h3>
        </Link>
        <p className="t-body mt-3 text-smoke">{prebuilt.tagline}</p>

        <PriceBlock
          className="mt-6"
          compareAtPaise={prebuilt.compareAtPaise}
          pricePaise={prebuilt.pricePaise}
          size="md"
        />

        <div className="mt-6 flex items-center gap-2.5">
          <Label className="mr-2">Finish</Label>
          {prebuilt.colourways.map((colourway) => (
            <span
              className="size-[15px] rounded-full border border-hairline"
              key={colourway.name}
              style={{ backgroundColor: colourway.hex }}
              title={colourway.name}
            />
          ))}
        </div>

        <SpecList className="mt-6" rows={prebuilt.headlineSpecs} />

        {/* Stacked, the first action takes the full width and the rest sit
            beneath it — three equal pills in a column reads as a menu. */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <PillLink
            className="w-full justify-center sm:w-auto"
            href={href}
            variant={primary ? "solid" : "ghost"}
          >
            See this machine
          </PillLink>
          <PillLink
            href={shellRoutes.prebuiltSpecs(prebuilt.slug)}
            variant="text"
          >
            Specs →
          </PillLink>
        </div>
      </div>
    </article>
  );
}

/** The stack, with a hairline between rows and none above the first. */
function PrebuiltRows({
  className,
  prebuilts,
  primarySlug,
}: {
  className?: string;
  prebuilts: PrebuiltSummary[];
  primarySlug?: string;
}) {
  return (
    <div className={cn(className)}>
      {prebuilts.map((prebuilt) => (
        <PrebuiltRow
          key={prebuilt.slug}
          prebuilt={prebuilt}
          primary={prebuilt.slug === primarySlug}
        />
      ))}
    </div>
  );
}

export { PrebuiltRow, PrebuiltRows };
