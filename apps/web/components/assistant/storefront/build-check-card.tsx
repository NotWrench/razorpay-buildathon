"use client";

import type {
  CompatibilityIssue,
  CompatibilityStatus,
} from "@workspace/commerce/compatibility";
import Link from "next/link";
import { CompatibilityStatusBadge } from "@/components/build/compatibility-status";
import { IssueList } from "@/components/build/issue-list";
import { PowerSummary } from "@/components/build/power-summary";
import { ToolCard } from "../primitives";

/**
 * The engine's verdict inside the chat.
 *
 * Deliberately the same components the builder page uses. A compatibility
 * answer that looks different depending on where it was asked invites the
 * buyer to trust whichever one they prefer.
 */

export interface BuildCheckShape {
  buildId?: string | null;
  canCheckout: boolean;
  estimatedWattage: number;
  issues: CompatibilityIssue[];
  name?: string;
  recommendedPsuWattage: number;
  status: CompatibilityStatus;
}

export function BuildCheckCard({
  slug,
  validation,
}: {
  slug?: string;
  validation: BuildCheckShape;
}) {
  const blocking = validation.issues.filter(
    (issue) => issue.severity === "blocking"
  );

  return (
    <ToolCard
      title={validation.name ? `Build — ${validation.name}` : "Compatibility"}
      tone={blocking.length > 0 ? "danger" : "neutral"}
    >
      <div className="mb-2 flex items-center gap-2">
        <CompatibilityStatusBadge status={validation.status} />
        <span className="text-muted-foreground text-xs">
          {validation.canCheckout
            ? "Can be ordered"
            : "Cannot be ordered as it stands"}
        </span>
      </div>

      <PowerSummary
        estimatedWattage={validation.estimatedWattage}
        recommendedPsuWattage={validation.recommendedPsuWattage}
      />

      <div className="mt-3">
        <IssueList issues={validation.issues} />
      </div>

      {slug && validation.buildId ? (
        <Link
          className="mt-3 inline-block font-medium text-primary text-xs underline underline-offset-4"
          href={`/store/${slug}/build?buildId=${validation.buildId}`}
        >
          Open in the builder
        </Link>
      ) : null}
    </ToolCard>
  );
}
