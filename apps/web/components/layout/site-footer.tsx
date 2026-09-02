import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { shellRoutes } from "@/lib/routes";

/**
 * The footer.
 *
 * The wordmark across the bottom is set at `--panel` on `--void`: enormous and
 * almost invisible, which is the point — it closes the page without asking for
 * attention. 64px of clear space above it, because an earlier version let
 * content run straight into the hairline.
 */

const COLUMNS: { heading: string; links: { href: Route; label: string }[] }[] =
  [
    {
      heading: "Machines",
      links: [
        { href: shellRoutes.prebuilt("arc"), label: "ARC" },
        { href: shellRoutes.prebuilt("volt"), label: "VOLT" },
        { href: shellRoutes.prebuilt("meridian"), label: "MERIDIAN" },
        { href: shellRoutes.prebuilt("forge"), label: "FORGE" },
      ],
    },
    {
      heading: "Components",
      links: [
        { href: shellRoutes.shopCategory("gpu"), label: "Graphics cards" },
        { href: shellRoutes.shopCategory("cpu"), label: "Processors" },
        { href: shellRoutes.shopCategory("ram"), label: "Memory" },
        { href: shellRoutes.shopCategory("storage"), label: "Storage" },
      ],
    },
    {
      heading: "Help",
      links: [
        { href: shellRoutes.assistant, label: "Ask the assistant" },
        { href: shellRoutes.cart, label: "Your cart" },
        { href: shellRoutes.account, label: "Orders" },
        { href: shellRoutes.login, label: "Sign in" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: shellRoutes.home, label: "About" },
        { href: shellRoutes.home, label: "Warranty" },
        { href: shellRoutes.home, label: "Shipping" },
        { href: shellRoutes.home, label: "Contact" },
      ],
    },
  ];

function SiteFooter() {
  return (
    <footer className="mt-32 border-hairline border-t">
      <div className="mx-auto w-full max-w-[1440px] px-5 pt-16 sm:px-8 lg:px-10 2xl:px-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_360px]">
          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <Label>{column.heading}</Label>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      className="text-[15px] text-smoke transition-colors duration-[180ms] hover:text-bone"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <Label>New machines, twice a year</Label>
            <p className="mt-5 max-w-[38ch] text-[15px] text-smoke">
              We write when there is a new machine or a real price change.
              Nothing else.
            </p>
            <form className="mt-6 flex items-center gap-2">
              <input
                aria-label="Email address"
                className="h-11 min-w-0 flex-1 rounded-full border border-hairline bg-transparent px-5 text-[15px] text-bone placeholder:text-smoke focus:border-smoke focus:outline-none"
                name="email"
                placeholder="you@example.com"
                type="email"
              />
              <Pill
                aria-label="Subscribe"
                className="size-11 px-0"
                type="submit"
                variant="ghost"
              >
                <ArrowRight aria-hidden className="size-4" />
              </Pill>
            </form>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-hairline border-t pt-8">
          <p className="text-[13px] text-smoke">
            © {new Date().getFullYear()} Nexus Systems, Bengaluru.
          </p>
          <p className="font-mono text-[13px] text-smoke tabular-nums">
            GSTIN 29AABCN1234F1Z5
          </p>
        </div>

        <p
          aria-hidden
          className="mt-16 select-none text-center font-bold font-display text-[clamp(4rem,18vw,16rem)] text-panel leading-[0.8] tracking-[-0.04em]"
        >
          NEXUS
        </p>
      </div>
    </footer>
  );
}

export { SiteFooter };
