import { Shimmer } from "@workspace/ui/components/motion/shimmer";
import { ComponentCardSkeleton } from "@/components/product/component-card";

/**
 * What the prerender puts in the HTML.
 *
 * The grid reads the query string, and a client component that reads search
 * params is skipped during prerendering — so whatever this renders *is* the
 * initial HTML for the shelf. An empty boundary meant the server sent markup
 * React then never claimed, and the page sat there unhydrated. This is the
 * loading state, at the grid's exact dimensions, so nothing shifts when the
 * real cards arrive.
 */

const SKELETON_KEYS = Array.from({ length: 9 }, (_, index) => `card-${index}`);

function ShopFallback({ name }: { name: string }) {
  return (
    <>
      <section>
        <div className="h-[240px] w-full bg-[linear-gradient(155deg,#262626_0%,#151515_100%)] lg:h-[280px]" />
        <div className="mx-auto w-full max-w-[1280px] px-8 lg:px-16">
          <div className="relative -mt-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="t-display-lg text-bone leading-none">
                {name}
              </h1>
              <p className="mt-3 h-5" />
            </div>
            <Shimmer className="h-9 w-40" radius="pill" />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1280px] px-8 pt-12 lg:px-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {SKELETON_KEYS.map((key) => (
            <ComponentCardSkeleton key={key} />
          ))}
        </div>
      </div>
    </>
  );
}

export { ShopFallback };
