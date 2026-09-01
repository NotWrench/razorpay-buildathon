"use client";

import type { ReactNode } from "react";
import { ApprovalCard } from "./cards";
import { ErrorCard, ToolCard, ToolStatus } from "./primitives";

/**
 * The tool-call state machine, rendered once for both agents.
 *
 * A tool part moves through streaming → available → (approval) → output, and
 * every one of those states has a right answer that is the same whichever
 * agent produced it. The only thing that differs per agent is the card drawn
 * for a finished output, which is why that arrives as a render prop.
 *
 * The approval branch is the one that matters: while it is on screen the tool
 * has *not* run and the loop is suspended server-side. It is a gate, not a
 * notification.
 */

export interface ToolPartShape {
  approval?: { id: string; isAutomatic?: boolean; requestReason?: string };
  errorText?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  state: string;
  toolCallId?: string;
  type: string;
}

/** Narrows a message part to a tool part, or null when it is something else. */
export function asToolPart(part: { type: string }): ToolPartShape | null {
  return part.type.startsWith("tool-")
    ? (part as unknown as ToolPartShape)
    : null;
}

export function ToolPart({
  deniedNote,
  onApproval,
  part,
  pendingLabel,
  renderOutput,
}: {
  deniedNote: string;
  onApproval: (response: { approved: boolean; id: string }) => void;
  part: ToolPartShape;
  pendingLabel: (type: string) => string;
  renderOutput: (part: ToolPartShape) => ReactNode;
}) {
  if (part.state === "approval-requested") {
    if (part.approval?.isAutomatic) {
      return <ToolStatus>Checking policy…</ToolStatus>;
    }

    return (
      <ApprovalCard
        onApprove={() =>
          onApproval({ approved: true, id: part.approval?.id ?? "" })
        }
        onDeny={() =>
          onApproval({ approved: false, id: part.approval?.id ?? "" })
        }
        reason={part.approval?.requestReason}
      />
    );
  }

  if (part.state === "output-denied") {
    return (
      <ToolCard title="Not done">
        <p className="text-muted-foreground">{deniedNote}</p>
      </ToolCard>
    );
  }

  if (part.state === "output-error") {
    return <ErrorCard message={part.errorText ?? "Something went wrong."} />;
  }

  if (part.state === "input-streaming" || part.state === "input-available") {
    return <ToolStatus>{pendingLabel(part.type)}</ToolStatus>;
  }

  if (part.state !== "output-available" || !part.output) {
    return null;
  }

  return <>{renderOutput(part)}</>;
}
