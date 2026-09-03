import { Label } from "@workspace/ui/components/label";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { PrebuiltDetail } from "@/lib/data/types";
import { shellRoutes } from "@/lib/routes";

/**
 * What is actually in the box.
 *
 * Every row links to the part's own page, because "MERIDIAN has a 9800X3D" is
 * only useful if you can go and read about the 9800X3D. Status appears on the
 * rows that have something to say and nowhere else — a column of green ticks
 * teaches the eye to skip the column.
 */

const STATE_MESSAGE = {
  compatible: "Checked against the rest of the build.",
  incompatible: "Conflicts with another part in this build.",
  insufficient_data: "Not enough published data to confirm the fit.",
  needs_verification: "Worth confirming before this ships.",
} as const;

function PowerBar({ draw, supply }: { draw: number; supply: number }) {
  const ratio = Math.min(draw / supply, 1);

  return (
    <div className="mt-10">
      <p className="font-mono text-[13px] text-smoke tabular-nums">
        {draw} W estimated · {supply} W supply
      </p>
      <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-hairline">
        <div
          className="power-bar h-full rounded-full bg-smoke"
          style={{ "--power-ratio": ratio } as CSSProperties}
        />
      </div>
    </div>
  );
}

function ManifestTable({ machine }: { machine: PrebuiltDetail }) {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-8 lg:px-16">
      <Label>What&rsquo;s inside</Label>

      <ul className="mt-8 border-hairline border-t">
        {machine.manifest.map((entry) => (
          <li className="border-hairline border-b py-5" key={entry.slot}>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <Label className="w-32 shrink-0">{entry.slot}</Label>
              <Link
                className="flex-1 text-[15px] text-bone transition-colors duration-[180ms] hover:text-smoke"
                href={shellRoutes.product(entry.product.id)}
              >
                {entry.product.name}
              </Link>
              <span className="font-mono text-[13px] text-smoke tabular-nums">
                {formatPaise(entry.product.pricePaise)}
              </span>
            </div>
            {entry.state ? (
              <StatusLine
                className="mt-2 pl-40"
                message={STATE_MESSAGE[entry.state]}
                state={entry.state}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <PowerBar
        draw={machine.estimatedWattage}
        supply={machine.psuRatedWattage}
      />
    </section>
  );
}

export { ManifestTable };
