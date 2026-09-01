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
      <p className="text-foreground">
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
