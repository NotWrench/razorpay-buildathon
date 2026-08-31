"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPaise } from "@/lib/format";

/**
 * AI-drafted campaigns awaiting a decision.
 *
 * A draft has never touched a price. Approving is what makes the discount real,
 * which is why the reasoning the AI gave is displayed rather than summarised.
 */

export interface InboxCampaign {
  approvedByMerchant: boolean;
  discountType: "percentage" | "flat" | "bundle";
  discountValue: number;
  id: string;
  reason: string | null;
  status: string;
  title: string;
}

function describeDiscount(campaign: InboxCampaign): string {
  return campaign.discountType === "percentage"
    ? `${campaign.discountValue}% off`
    : `${formatPaise(campaign.discountValue)} off`;
}

export function CampaignInbox({ campaigns }: { campaigns: InboxCampaign[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(campaignId: string, approved: boolean) {
    setBusy(campaignId);

    try {
      await fetch(`/api/campaigns/${campaignId}/approve`, {
        body: JSON.stringify({ approved }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
        Campaigns ({campaigns.length})
      </h2>

      {campaigns.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          None yet. Ask the assistant what isn&apos;t selling.
        </p>
      ) : null}

      <ul className="space-y-3">
        {campaigns.map((campaign) => (
          <li
            className="rounded-md border border-border p-3 text-sm"
            key={campaign.id}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium leading-tight">
                {campaign.title}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                  campaign.status === "active" &&
                    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                  campaign.status === "pending_approval" &&
                    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                  campaign.status !== "active" &&
                    campaign.status !== "pending_approval" &&
                    "bg-muted text-muted-foreground"
                )}
              >
                {campaign.status.replace(/_/g, " ")}
              </span>
            </div>

            <p className="mt-0.5 text-muted-foreground text-xs">
              {describeDiscount(campaign)}
            </p>

            {campaign.reason ? (
              <p className="mt-2 border-border border-l-2 pl-2 text-muted-foreground text-xs italic">
                {campaign.reason}
              </p>
            ) : null}

            {campaign.status === "pending_approval" ||
            campaign.status === "draft" ? (
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={busy === campaign.id}
                  onClick={() => decide(campaign.id, true)}
                  size="sm"
                >
                  Approve &amp; activate
                </Button>
                <Button
                  disabled={busy === campaign.id}
                  onClick={() => decide(campaign.id, false)}
                  size="sm"
                  variant="outline"
                >
                  Reject
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
