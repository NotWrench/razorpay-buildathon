import { Label } from "@workspace/ui/components/label";
import { StatusLine } from "@workspace/ui/components/status-line";
import Link from "next/link";
import type { ReactNode } from "react";
import { PillLink } from "@/components/common/pill-link";
import type { CompatibilityCheck, CompatibilityReport } from "@/lib/data/types";
import { shellRoutes } from "@/lib/routes";

/**
 * The page's reason to exist, and the only coloured thing in this column.
 *
 * It never states a verdict the engine did not give: the state, the wording
 * and the rule all come from the report. A missing figure reads as
 * "insufficient data" in smoke rather than quietly rounding up to compatible,
 * because a confident wrong answer here costs someone a return.
 */

const HEADLINE = {
  compatible: "Fits your build",
  incompatible: "Will not fit your build",
  insufficient_data: "Cannot confirm the fit",
  needs_verification: "Worth checking",
} as const;

/**
 * Turns the part names a check mentions into links, in place.
 *
 * The alternative — a sentence followed by a list of links — makes the reader
 * work out which name goes with which clause.
 */
function linkifyParts(check: CompatibilityCheck): ReactNode {
  const names = check.relatedProducts ?? [];

  let remaining = check.message;
  const nodes: ReactNode[] = [];

  for (const product of names) {
    const at = remaining.indexOf(product.name);

    if (at === -1) {
      continue;
    }

    nodes.push(remaining.slice(0, at));
    nodes.push(
      <Link
        className="text-bone underline decoration-hairline underline-offset-4 transition-colors duration-[180ms] hover:decoration-smoke"
        href={shellRoutes.product(product.id)}
        key={product.id}
      >
        {product.name}
      </Link>
    );
    remaining = remaining.slice(at + product.name.length);
  }

  nodes.push(remaining);

  return nodes;
}

function CompatibilityStrip({ report }: { report?: CompatibilityReport }) {
  if (!report) {
    return (
      <div className="border-hairline border-t border-b py-6">
        <Label>Compatibility</Label>
        <p className="mt-3 text-[15px] text-smoke">
          No build open yet. Start one and this page will check every part
          against it.
        </p>
        <PillLink className="mt-3" href={shellRoutes.assistant} variant="text">
          Start a build →
        </PillLink>
      </div>
    );
  }

  /* The check that decided the verdict is the one worth reading first. */
  const leading =
    report.checks.find((check) => check.state === report.overall) ??
    report.checks[0];

  return (
    <div className="border-hairline border-t border-b py-6">
      <div className="flex items-baseline justify-between gap-4">
        <Label>Compatibility</Label>
        {report.buildName ? (
          <span className="text-[13px] text-smoke">{report.buildName}</span>
        ) : null}
      </div>

      <p className="mt-3 text-[15px] text-bone">{HEADLINE[report.overall]}</p>

      {leading ? (
        <StatusLine
          className="mt-2"
          message={linkifyParts(leading)}
          state={leading.state}
        />
      ) : null}

      {report.estimatedWattage && report.psuRatedWattage ? (
        <p className="mt-3 font-mono text-[13px] text-smoke tabular-nums">
          {report.estimatedWattage} W estimated · {report.psuRatedWattage} W
          supply
        </p>
      ) : null}

      {report.overall === "incompatible" ? (
        <PillLink className="mt-3" href={shellRoutes.assistant} variant="text">
          Show me options →
        </PillLink>
      ) : null}
    </div>
  );
}

export { CompatibilityStrip };
