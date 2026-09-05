"use client";

import { Button } from "@workspace/ui/components/button";
import { ToolCard } from "../primitives";

export function ApprovalCard({
  onApprove,
  onDeny,
  reason,
}: {
  onApprove: () => void;
  onDeny: () => void;
  reason?: string;
}) {
  return (
    <ToolCard title="Your approval is needed" tone="warning">
      {/*
        The reason arrives as paragraphs — the terms, the case for it, and any
        overlap it would collide with — because on a campaign this card is the
        merchant's whole decision rather than a confirmation of one they
        already made in the thread. Run together as one block, nobody reads
        past the first line.
      */}
      <p className="whitespace-pre-line text-foreground">
        {reason ?? "This action involves money and needs your confirmation."}
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={onApprove} size="sm">
          Approve
        </Button>
        <Button onClick={onDeny} size="sm" variant="outline">
          Not now
        </Button>
      </div>
    </ToolCard>
  );
}
