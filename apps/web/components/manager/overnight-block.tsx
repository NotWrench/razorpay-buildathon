"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { managerRoutes } from "@/lib/routes";

/**
 * What the assistant did while nobody was watching.
 *
 * It sits above the briefing because it is the only thing on this page that
 * happened *since* the merchant last looked. Everything below is the state of
 * the store, which was true yesterday too.
 *
 * The claim it makes is the important part: nothing here is live. An
 * unattended run cannot approve anything — every money tool suspends for a
 * human who was not there — so what it leaves behind is a campaign that
 * discounts nothing and a reorder that buys nothing, both waiting.
 */

interface BriefingResponse {
  data?: {
    blockedTools: string[];
    draftedCampaigns: number;
    raisedReorders: number;
    text: string;
  };
}

function OvernightBlock({ merchantId }: { merchantId: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BriefingResponse["data"] | null>(null);

  const run = useCallback(async () => {
    setRunning(true);

    try {
      const response = await fetch("/api/agent/merchant/briefing", {
        body: JSON.stringify({ merchantId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        toast.error(body?.error?.message ?? "The briefing did not run.");

        return;
      }

      const body = (await response.json()) as BriefingResponse;

      setResult(body.data ?? null);
    } finally {
      setRunning(false);
    }
  }, [merchantId]);

  const onRun = useCallback(() => {
    run().catch(() => toast.error("The briefing did not run."));
  }, [run]);

  if (!result) {
    return (
      <section className="mt-14">
        <Label>While you were away</Label>
        <p className="mt-5 t-body-lg text-smoke">
          Run the assistant unattended over the last week. It reads the
          numbers, and can leave at most one draft campaign and one reorder
          request — it cannot approve anything, because approving needs you.
        </p>
        <div className="mt-5">
          <Pill disabled={running} onClick={onRun} size="sm" variant="ghost">
            {running ? "Reading the store…" : "Run the briefing"}
          </Pill>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-14 rounded-[18px] border border-hairline bg-panel p-7">
      <Label>While you were away</Label>

      <p className="mt-5 whitespace-pre-wrap t-body text-bone leading-relaxed">
        {result.text}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-hairline border-t pt-5">
        <span className="t-body-sm text-smoke">
          {result.draftedCampaigns} campaign draft(s), {result.raisedReorders}{" "}
          reorder request(s). Nothing is live.
        </span>

        {result.draftedCampaigns > 0 ? (
          <Link
            className="t-body-sm text-bone underline underline-offset-4"
            href={managerRoutes.campaigns as Route}
          >
            Review the campaign
          </Link>
        ) : null}

        {result.raisedReorders > 0 ? (
          <Link
            className="t-body-sm text-bone underline underline-offset-4"
            href={managerRoutes.restock as Route}
          >
            Review the reorder
          </Link>
        ) : null}
      </div>

      {/*
        Not a footnote. A merchant reading "it did this overnight" should be
        able to see, on the same card, exactly which of its attempts the gate
        stopped — that is the difference between an assistant that was allowed
        to act and one that was not.
      */}
      {result.blockedTools.length > 0 ? (
        <p className="mt-3 t-body-sm text-smoke">
          It tried {result.blockedTools.join(", ")} and was stopped — those
          need you.
        </p>
      ) : null}
    </section>
  );
}

export { OvernightBlock };
