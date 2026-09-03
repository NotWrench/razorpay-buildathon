import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { SpecList } from "@workspace/ui/components/spec-list";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { PillLink } from "@/components/common/pill-link";
import { ProductRender } from "@/components/common/product-render";
import type { PrebuiltSummary } from "@/lib/data/types";
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
    <article className="group grid gap-9 py-8 transition-transform duration-[180ms] hover:-translate-y-0.5 lg:grid-cols-[44%_1fr]">
      <ImageGround className="aspect-[4/3] p-10">
        <ProductRender
          alt={`${prebuilt.name} tower`}
          category="case"
          className="transition-transform duration-[420ms] group-hover:scale-[1.03]"
        />
      </ImageGround>

      <div className="flex flex-col">
        <Link href={href}>
          <h3 className="font-display font-medium text-[28px] text-bone uppercase leading-none tracking-[0.05em]">
            {prebuilt.name}
          </h3>
        </Link>
        <p className="mt-3 text-[14.5px] text-smoke">{prebuilt.tagline}</p>

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
            Customize
          </PillLink>
          <PillLink href={href} variant="ghost">
            Preconfigured
          </PillLink>
          <PillLink className="ml-1" href={href} variant="text">
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
    <div className={cn("[&>*+*]:border-hairline [&>*+*]:border-t", className)}>
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
