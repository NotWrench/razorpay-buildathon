import { Label } from "@workspace/ui/components/label";
import type { Route } from "next";
import Link from "next/link";
import { PillLink } from "@/components/common/pill-link";
import { shellRoutes } from "@/lib/routes";

/**
 * The footer.
 *
 * The wordmark across the bottom is set at `--panel` on `--void`: enormous and
 * almost invisible, which is the point — it closes the page without asking for
 * attention. 64px of clear space above it, because an earlier version let
 * content run straight into the footer's top edge.
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
        { href: shellRoutes.about, label: "About" },
        { href: shellRoutes.warranty, label: "Warranty" },
        { href: shellRoutes.shipping, label: "Shipping" },
        { href: shellRoutes.contact, label: "Contact" },
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
                      className="t-body text-smoke transition-colors duration-micro hover:text-bone"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/*
            This column held a newsletter sign-up with no onSubmit and no
            action, so the arrow ran a native GET and reloaded the page with
            the address in the query string. There is no subscriber table
            behind it either, so wiring it would have meant promising a
            mailing list that does not exist. It points at the two ways of
            reaching us that do.
          */}
          <div>
            <Label>Talk to us</Label>
            <p className="t-body mt-5 max-w-[38ch] text-smoke">
              Questions about a part, a build or an order. The assistant answers
              instantly; a person answers within a day.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <PillLink href={shellRoutes.assistant} size="sm" variant="ghost">
                Ask the assistant
              </PillLink>
              <PillLink href={shellRoutes.contact} size="sm" variant="ghost">
                Contact us
              </PillLink>
            </div>
          </div>
        </div>

        {/*
          The mark used to close this page at clamp(4rem,18vw,16rem) — up to
          256px — painted `text-panel`, which is --panel on --void: a contrast
          ratio of about 1.1:1. It was the largest element on the site and it
          rendered as a smudge. It sits in the legal strip now, at the size the
          header uses, where it reads as a signature instead.
        */}
        <div className="rule-section mt-16 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-8 pb-12">
          <div className="flex items-center gap-4">
            <Link
              aria-label="Nexus, home"
              className="flex items-baseline gap-1"
              href={shellRoutes.home}
            >
              <span className="t-display-sm font-bold text-bone">NEXUS</span>
              <span
                aria-hidden
                className="size-[5px] rounded-full bg-lacquer"
              />
            </Link>
            <span aria-hidden className="h-4 w-px bg-hairline" />
            <p className="t-body-sm text-smoke">
              © {new Date().getFullYear()} Nexus Systems, Bengaluru.
            </p>
          </div>

          <p className="t-num-xs text-smoke">GSTIN 29AABCN1234F1Z5</p>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
