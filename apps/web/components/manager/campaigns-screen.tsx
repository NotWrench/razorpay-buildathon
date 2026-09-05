"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useMemo } from "react";
import { ManagerHeading } from "@/components/manager/manager-heading";
import { useAction } from "@/hooks/use-action";
import {
  activateCampaignAction,
  pauseCampaignAction,
  rejectCampaignAction,
} from "@/lib/actions/campaigns";
import type { ManagerCampaign } from "@/lib/data/types";

/**
 * Campaigns, as something you run rather than something you approve once.
 *
 * The old inbox showed a title, a discount and two buttons — enough to say yes
 * and nothing like enough to look after a live promotion. What a merchant
 * needs from a running campaign is how much of its budget it has already given
 * away and how long it has left, because those are the two numbers that decide
 * whether to leave it alone or stop it.
 *
 * A draft's stated business case is shown in full, never truncated. It is the
 * merchant's only evidence for the decision they are being asked to make, and
 * a reason worth eliding is a reason not worth acting on.
 */

const STATUS_TONE: Record<string, string> = {
  active: "text-verdant",
  expired: "text-smoke",
  paused: "text-amber",
  pending_approval: "text-amber",
  rejected: "text-smoke",
};

function CampaignRow({
  busy,
  campaign,
  onActivate,
  onPause,
  onReject,
}: {
  busy: boolean;
  campaign: ManagerCampaign;
  onActivate: (id: string) => void;
  onPause: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const activate = useCallback(
    () => onActivate(campaign.id),
    [campaign.id, onActivate]
  );
  const pause = useCallback(() => onPause(campaign.id), [campaign.id, onPause]);
  const reject = useCallback(
    () => onReject(campaign.id),
    [campaign.id, onReject]
  );

  const live = campaign.status === "active";
  const decidable =
    campaign.status === "pending_approval" ||
    campaign.status === "draft" ||
    campaign.status === "paused";

  return (
    <div className="border-hairline border-b py-7">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="t-body-lg text-bone">{campaign.title}</p>
          <p className="mt-1.5 t-body-sm text-smoke">{campaign.summary}</p>

          {campaign.productNames.length > 0 ? (
            <p className="mt-1 t-body-sm text-smoke">
              {campaign.productNames.join(", ")}
            </p>
          ) : null}

          {campaign.reason ? (
            <p className="mt-3 border-hairline border-l-2 pl-4 t-body-sm text-smoke italic">
              {campaign.reason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span
            className={cn(
              "t-body-sm",
              STATUS_TONE[campaign.status] ?? "text-smoke"
            )}
          >
            {campaign.status.replace(/_/g, " ")}
          </span>

          {live ? (
            <Pill disabled={busy} onClick={pause} size="sm" variant="ghost">
              Stop
            </Pill>
          ) : null}

          {decidable ? (
            <>
              <Pill
                disabled={busy}
                onClick={activate}
                size="sm"
                variant="ghost"
              >
                {campaign.status === "paused" ? "Resume" : "Activate"}
              </Pill>
              {campaign.status === "paused" ? null : (
                <Pill disabled={busy} onClick={reject} size="sm" variant="text">
                  Reject
                </Pill>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CampaignsScreen({ campaigns }: { campaigns: ManagerCampaign[] }) {
  const activate = useAction(activateCampaignAction, {
    successMessage: "Live. It discounts matching carts from now on.",
  });
  const pause = useAction(pauseCampaignAction, {
    successMessage: "Stopped. Orders already placed are unaffected.",
  });
  const reject = useAction(rejectCampaignAction, {
    successMessage: "Rejected. No price ever moved.",
  });

  const busy = activate.pending || pause.pending || reject.pending;

  const { live, waiting, finished } = useMemo(
    () => ({
      finished: campaigns.filter((row) =>
        ["expired", "rejected"].includes(row.status)
      ),
      live: campaigns.filter((row) => row.status === "active"),
      waiting: campaigns.filter((row) =>
        ["draft", "paused", "pending_approval"].includes(row.status)
      ),
    }),
    [campaigns]
  );

  const section = (title: string, rows: ManagerCampaign[], empty: string) => (
    <section className="pb-12">
      <Label>{title}</Label>
      {rows.length === 0 ? (
        <p className="mt-5 t-body-lg text-smoke">{empty}</p>
      ) : (
        <div className="mt-5 border-hairline border-t">
          {rows.map((campaign) => (
            <CampaignRow
              busy={busy}
              campaign={campaign}
              key={campaign.id}
              onActivate={activate.run}
              onPause={pause.run}
              onReject={reject.run}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading
        count={live.length > 0 ? `${live.length} running` : "none running"}
        title="Campaigns"
      />

      {section(
        "Running",
        live,
        "Nothing is discounting anything right now."
      )}
      {section(
        "Waiting on you",
        waiting,
        "No drafts. Ask the assistant what is not selling."
      )}
      {section("Finished", finished, "Nothing has run and ended yet.")}
    </div>
  );
}

export { CampaignsScreen };
