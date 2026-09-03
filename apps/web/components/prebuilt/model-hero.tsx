import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { KenBurns } from "@workspace/ui/components/motion/ken-burns";
import { Pill } from "@workspace/ui/components/pill";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { ProductRender } from "@/components/common/product-render";
import type { PrebuiltDetail } from "@/lib/data/types";

/**
 * Band 1. The machine, its one line of positioning, and the only solid red
 * pill on the page.
 */
function ModelHero({ machine }: { machine: PrebuiltDetail }) {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="absolute inset-0">
        <KenBurns className="h-full w-full">
          <ImageGround className="h-full w-full rounded-none p-16">
            <ProductRender alt={`${machine.name} tower`} category="case" />
          </ImageGround>
        </KenBurns>
      </div>
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(105deg,#060606_0%,rgba(6,6,6,0.86)_44%,rgba(6,6,6,0.1)_86%)]"
      />

      <div className="relative mx-auto w-full max-w-[1280px] px-8 py-28 lg:px-16 lg:py-36">
        <h1 className="font-display font-medium text-[clamp(36px,6vw,56px)] text-bone uppercase leading-none tracking-[0.05em]">
          {machine.name}
        </h1>
        <p className="mt-6 max-w-[40ch] text-[17px] text-smoke">
          {machine.tagline}
        </p>

        <div className="mt-8 flex items-center gap-2.5">
          <Label className="mr-2">Finish</Label>
          {machine.colourways.map((colourway) => (
            <span
              className="size-[15px] rounded-full border border-hairline"
              key={colourway.name}
              style={{ backgroundColor: colourway.hex }}
              title={colourway.name}
            />
          ))}
        </div>

        <PriceBlock
          className="mt-8"
          compareAtPaise={machine.compareAtPaise}
          pricePaise={machine.pricePaise}
          size="lg"
        />

        <Pill className="mt-9">Configure</Pill>
      </div>
    </section>
  );
}

export { ModelHero };
