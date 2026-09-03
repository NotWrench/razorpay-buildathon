import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { SpecList } from "@workspace/ui/components/spec-list";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { PillLink } from "@/components/common/pill-link";
import { ProductRender } from "@/components/common/product-render";
import type { PrebuiltDetail, ProductSummary } from "@/lib/data/types";
import { shellRoutes } from "@/lib/routes";

/**
 * Band 3 — full-bleed on --carbon, split 55/45.
 *
 * The agent is the reason this store exists, so it gets a band rather than a
 * mention: a real question, a real part, and the build peek underneath. One
 * product, but with enough around it to be worth looking at.
 */
interface AssistantBandProps {
  machine: PrebuiltDetail;
  pick: ProductSummary;
}

function AssistantBand({ machine, pick }: AssistantBandProps) {
  const partCount = machine.manifest.length;

  return (
    <section className="w-full bg-carbon py-24 lg:py-28">
      <div className="mx-auto grid w-full max-w-[1440px] gap-14 px-5 sm:px-8 lg:grid-cols-[55%_1fr] lg:px-10 2xl:px-16">
        <div>
          <Label>The assistant</Label>

          <p className="mt-6 max-w-[22ch] font-display font-semibold text-[40px] text-bone leading-[1.05] tracking-[-0.03em]">
            “₹80,000, 1440p, mostly competitive shooters.”
          </p>
          <p className="mt-5 max-w-[54ch] text-[15px] text-smoke">
            Then spend it on the card and the panel refresh, not the case. Here
            is what that looks like.
          </p>

          <div className="mt-9 flex items-center gap-5 border-hairline border-t border-b py-5">
            <ImageGround className="size-14 shrink-0 p-2">
              <ProductRender alt={pick.name} category={pick.category} />
            </ImageGround>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] text-bone">{pick.name}</p>
              <p className="mt-1 font-mono text-[13px] text-smoke tabular-nums">
                {pick.keySpecs.map((spec) => spec.value).join(" · ")}
              </p>
            </div>
            <PriceBlock
              className="justify-end"
              pricePaise={pick.pricePaise}
              size="sm"
            />
          </div>

          <SpecList className="mt-8" rows={machine.headlineSpecs} />

          <div className="mt-5 flex items-baseline justify-between gap-6">
            <Label>Build total</Label>
            <span className="font-mono text-[21px] text-bone tabular-nums">
              {formatPaise(machine.pricePaise)}
            </span>
          </div>

          <StatusLine
            className="mt-5"
            message={`All ${partCount} parts compatible.`}
            state="compatible"
          />

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <PillLink href={shellRoutes.prebuilt(machine.slug)} variant="ghost">
              See the full build
            </PillLink>
            <PillLink href={shellRoutes.assistant} variant="text">
              Try it yourself →
            </PillLink>
          </div>
        </div>

        <ImageGround className="min-h-[420px] p-12">
          <ProductRender
            alt={`${machine.name} tower`}
            category="case"
            className="h-full w-auto max-w-full"
          />
        </ImageGround>
      </div>
    </section>
  );
}

export { AssistantBand };
