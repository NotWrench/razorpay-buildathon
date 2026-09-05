import { Label } from "@workspace/ui/components/label";
import { Reveal } from "@workspace/ui/components/motion/reveal";
import type { ReactNode } from "react";

/**
 * The editorial page.
 *
 * Four footer links — About, Warranty, Shipping, Contact — all pointed at "/"
 * before this existed. They are short, mostly-text pages that share one
 * shape, so they share one component rather than four near-identical files.
 *
 * The measure is capped at 66ch per §4.5: a line of body text wider than that
 * is harder to read, and the page has no second column to fill.
 */

interface ProseSection {
  body: ReactNode;
  heading: string;
}

function ProsePage({
  intro,
  kicker,
  sections,
  title,
}: {
  intro: string;
  kicker: string;
  sections: ProseSection[];
  title: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-16 sm:px-8 lg:px-10 lg:py-24 2xl:px-16">
      <header className="max-w-[66ch]">
        <Label>{kicker}</Label>
        <h1 className="t-display-lg mt-4 text-bone">{title}</h1>
        <p className="t-body-lg mt-6 text-smoke">{intro}</p>
      </header>

      <div className="mt-16 max-w-[66ch] space-y-12">
        {sections.map((section) => (
          <Reveal key={section.heading}>
            <section className="rule-section pt-8">
              <h2 className="t-display-sm text-bone">{section.heading}</h2>
              <div className="t-body mt-4 space-y-4 text-smoke">
                {section.body}
              </div>
            </section>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export type { ProseSection };
export { ProsePage };
