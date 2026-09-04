import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Shimmer } from "@workspace/ui/components/motion/shimmer";
import { Pill } from "@workspace/ui/components/pill";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { SpecList } from "@workspace/ui/components/spec-list";
import { StatusLine } from "@workspace/ui/components/status-line";
import { ProductRender } from "@/components/common/product-render";
import type { ProductSummary } from "@/lib/data/types";

/**
 * The foundation, on one screen.
 *
 * Nothing here ships — it exists so the primitives can be judged before any
 * page is built on top of them.
 */

const SPECIMEN_CATEGORIES = [
  "gpu",
  "cpu",
  "ram",
  "storage",
  "psu",
  "case",
  "cooler",
  "fan",
  "motherboard",
  "monitor",
  "peripheral",
] as const;

function Bay({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-hairline border-b py-10">
      <Label>{title}</Label>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Primitives({ product }: { product?: ProductSummary }) {
  return (
    <div className="border-hairline border-t">
      <Bay title="Pill — the only button shape">
        <div className="flex flex-wrap items-center gap-4">
          <Pill>Customize</Pill>
          <Pill variant="ghost">Preconfigured</Pill>
          <Pill variant="text">Specs →</Pill>
          <Pill size="sm">Add to cart</Pill>
          <Pill size="sm" variant="ghost">
            Compare
          </Pill>
          <Pill disabled>Out of stock</Pill>
        </div>
      </Bay>

      <Bay title="Type — display, sans, and mono for numbers only">
        <p className="t-display-lg text-bone leading-none">
          Archivo, set tight
        </p>
        <p className="t-model mt-3 text-bone text-xl">
          Meridian
        </p>
        <p className="t-body mt-4 max-w-[66ch] text-smoke">
          Inter Tight carries everything functional — this paragraph, the nav,
          every button. It never sets a number.
        </p>
        <p className="t-num-md mt-4 text-bone">
          ₹3,34,900 · 780 W · 16GB GDDR7
        </p>
      </Bay>

      <Bay title="Image ground and the category renders">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SPECIMEN_CATEGORIES.map((category) => (
            <ImageGround className="aspect-[3/2] p-4" key={category}>
              <ProductRender alt={category} category={category} />
            </ImageGround>
          ))}
        </div>
      </Bay>

      <Bay title="Spec list and price block">
        <div className="grid gap-10 sm:grid-cols-2">
          <SpecList rows={product?.keySpecs ?? []} />
          <div className="space-y-5">
            <PriceBlock
              compareAtPaise={12_499_000}
              pricePaise={10_990_000}
              size="lg"
            />
            <PriceBlock pricePaise={1_460_000} />
            <PriceBlock pricePaise={790_000} size="sm" />
          </div>
        </div>
      </Bay>

      <Bay title="Status — four states, text on transparent">
        <div className="space-y-3">
          <StatusLine
            message="Ryzen 7 9800X3D fits the AM5 socket on this board."
            state="compatible"
          />
          <StatusLine
            message="Three left at this price."
            state="needs_verification"
          />
          <StatusLine
            message="An 850 W unit leaves 70 W of headroom, under the 150 W required."
            state="incompatible"
          />
          <StatusLine
            message="No clearance figure is published for this pairing."
            state="insufficient_data"
          />
        </div>
      </Bay>

      <Bay title="Shimmer — the only skeleton">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Shimmer className="aspect-[3/2]" radius="ground" />
          <Shimmer className="aspect-[3/2]" radius="ground" />
          <Shimmer className="aspect-[3/2]" radius="ground" />
          <Shimmer className="aspect-[3/2]" radius="ground" />
        </div>
      </Bay>
    </div>
  );
}
