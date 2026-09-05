import { Label } from "@workspace/ui/components/label";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { ScrollProgress } from "@/components/layout/scroll-progress";
import { getProducts } from "@/lib/data";
import { route } from "@/lib/routes";
import { Primitives } from "./primitives";

/**
 * The review hub.
 *
 * Every prompt in docs/BUILD-PROMPTS.md adds a route; this page says which of
 * them exist yet. It is a working page, not a designed one — a hairline list
 * and nothing else.
 */

export const metadata: Metadata = {
  title: "Preview index",
};

interface PreviewRoute {
  built: boolean;
  description: string;
  href: Route;
  prompt: string;
}

const BUILD_ROUTES: PreviewRoute[] = [
  {
    built: true,
    description: "This index. Tokens, motion, primitives and mock fixtures.",
    href: route("/preview"),
    prompt: "00",
  },
  {
    built: true,
    description:
      "The shell — header, footer, route transition — around every store page.",
    href: route("/preview"),
    prompt: "01",
  },
  {
    built: true,
    description: "The landing page — seven bands, image-led, the model lineup.",
    href: route("/"),
    prompt: "02",
  },
  {
    built: true,
    description:
      "Search overlay — the header trigger, ⌘K / Ctrl+K, or “/” from any route.",
    href: route("/preview"),
    prompt: "03",
  },
  {
    built: true,
    description: "Every component, with the filter sheet and load-more.",
    href: route("/shop"),
    prompt: "04",
  },
  {
    built: true,
    description: "One category — the same shelf with a slug applied.",
    href: route("/shop/gpu"),
    prompt: "04",
  },
  {
    built: true,
    description:
      "Product detail — the compatibility strip is the point. Try /product/gpu-4.",
    href: route("/product/gpu-4"),
    prompt: "05",
  },
  {
    built: true,
    description:
      "The four machines as full-width rows, with a use-case filter.",
    href: route("/prebuilts"),
    prompt: "06",
  },
  {
    built: true,
    description:
      "One machine — hero, named features, gallery, manifest, specs.",
    href: route("/prebuilts/meridian"),
    prompt: "06",
  },
  {
    built: true,
    description:
      "Cart — grouped by build, removal with undo, docked on mobile.",
    href: route("/cart"),
    prompt: "07",
  },
  {
    built: true,
    description:
      "Checkout — the summary is real, the button says it is a stub.",
    href: route("/checkout"),
    prompt: "07",
  },
  {
    built: true,
    description:
      "The assistant dock — read-only, bottom-right of /, /shop, /product, /cart.",
    href: route("/product/gpu-4"),
    prompt: "08",
  },
  {
    built: true,
    description: "Chat — thin bar, confident empty state, in-thread interview.",
    href: route("/assistant"),
    prompt: "09",
  },
  {
    built: true,
    description: "The build sheet, its upgrade lane, and the docked card.",
    href: route("/assistant"),
    prompt: "10",
  },
  {
    built: true,
    description: "Sign in — the left panel, and the column that crossfades.",
    href: route("/login"),
    prompt: "11",
  },
  {
    built: true,
    description: "The same screen, one field longer, with a strength meter.",
    href: route("/signup"),
    prompt: "11",
  },
  {
    built: true,
    description: "Profile — figures, orders, saved builds, addresses.",
    href: route("/account"),
    prompt: "11",
  },
  {
    built: true,
    description: "Settings — no cards, no solid red, a typed confirmation.",
    href: route("/account/settings"),
    prompt: "11",
  },
  {
    built: true,
    description: "Manager briefing — the summary IS the assistant page.",
    href: route("/manager"),
    prompt: "12",
  },
  {
    built: true,
    description: "Products — the catalogue as an editing surface.",
    href: route("/manager/products"),
    prompt: "13",
  },
  {
    built: true,
    description: "Orders — filters, inline lines, fulfil and refund.",
    href: route("/manager/orders"),
    prompt: "13",
  },
  {
    built: true,
    description: "Restock — editable thresholds and the assistant's drafts.",
    href: route("/manager/restock"),
    prompt: "13",
  },
  {
    built: true,
    description: "Store account — details, payment, team, closing.",
    href: route("/manager/account"),
    prompt: "13",
  },
];

const EXISTING_ROUTES: PreviewRoute[] = [
  {
    built: true,
    description:
      "The old store picker that used to be at / — moved aside for the landing page.",
    href: route("/stores"),
    prompt: "—",
  },
  {
    built: true,
    description: "The original storefront, untouched by this build.",
    href: route("/store/nexus-pc"),
    prompt: "—",
  },
  {
    built: true,
    description: "The original merchant dashboard.",
    href: route("/dashboard"),
    prompt: "—",
  },
  {
    built: true,
    description: "Sign in. Google, and nothing else.",
    href: route("/login"),
    prompt: "—",
  },
];

function RouteRow({ entry }: { entry: PreviewRoute }) {
  return (
    <li className="border-hairline border-b">
      <Link
        className="flex items-center gap-5 py-4 transition-colors duration-micro hover:bg-carbon"
        href={entry.href}
      >
        <span
          aria-hidden
          className={`size-1.5 shrink-0 rounded-full ${
            entry.built ? "bg-verdant" : "bg-hairline"
          }`}
        />
        <span className="t-num-xs w-40 shrink-0 text-bone">
          {entry.href}
        </span>
        <span className="t-body-sm flex-1 text-smoke">
          {entry.description}
        </span>
        <Label className="shrink-0">
          {entry.built ? "Built" : `Prompt ${entry.prompt}`}
        </Label>
      </Link>
    </li>
  );
}

export default async function PreviewIndexPage() {
  const [specimen] = await getProducts({ limit: 1 });

  return (
    <main className="mx-auto w-full max-w-[1000px] px-5 py-20 sm:px-8">
      <ScrollProgress />
      <Label>Build index</Label>
      <h1 className="t-display-lg mt-4 text-bone leading-none">
        Every route in the build
        <span className="text-lacquer">.</span>
      </h1>
      <p className="t-body mt-4 max-w-[66ch] text-smoke">
        One row per screen, in the order the prompts build them. A filled dot
        means the route exists and is worth looking at; an empty one means it is
        still a prompt away.
      </p>

      <ul className="mt-14 border-hairline border-t">
        {BUILD_ROUTES.map((entry) => (
          <RouteRow entry={entry} key={`${entry.prompt}-${entry.href}`} />
        ))}
      </ul>

      <h2 className="t-display-sm mt-16 text-bone">
        Already in the repo
      </h2>
      <ul className="mt-6 border-hairline border-t">
        {EXISTING_ROUTES.map((entry) => (
          <RouteRow entry={entry} key={entry.href} />
        ))}
      </ul>

      <h2 className="t-display-sm mt-20 text-bone">
        The foundation
      </h2>
      <p className="t-body mt-3 mb-6 max-w-[66ch] text-smoke">
        Every primitive the rest of the build is made from. Nothing below ships
        as a page — it is here to be judged before anything is built on it.
      </p>
      <Primitives product={specimen} />
    </main>
  );
}
