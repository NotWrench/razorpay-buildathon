"use client";

import { cleanToolPartType } from "@workspace/ai/client";
import type { ReactNode } from "react";
import { AskBuyerCard } from "./ask-buyer-card";
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

/**
 * Narrows a message part to a tool part, or null when it is something else.
 *
 * The type is cleaned on the way through. The model's control tokens are
 * already attached when `tool-input-start` streams, so a mangled call reaches
 * the browser as `tool-askBuyer<|channel|>commentary`; repairing it on the
 * server fixes which tool runs and nothing about which component draws. For a
 * question that is the whole conversation — it never appears, so it is never
 * answered, and the turn waits on a pending line for good.
 */
export function asToolPart(part: { type: string }): ToolPartShape | null {
  if (!part.type.startsWith("tool-")) {
    return null;
  }

  const shape = part as unknown as ToolPartShape;
  const type = cleanToolPartType(shape.type);

  return type === shape.type ? shape : { ...shape, type };
}

export function ToolPart({
  deniedNote,
  onAnswer,
  onApproval,
  part,
  pendingLabel,
  renderOutput,
}: {
  deniedNote: string;
  /** Absent on agents that cannot ask — the merchant's, today. */
  onAnswer?: (toolCallId: string, value: string) => void;
  onApproval: (response: { approved: boolean; id: string }) => void;
  part: ToolPartShape;
  pendingLabel: (type: string) => string;
  renderOutput: (part: ToolPartShape) => ReactNode;
}) {
  /*
   * A question is not a tool call that happened; it is one the turn is waiting
   * on. It has to be caught before the state machine below, which would
   * otherwise render the pending line — a spinner against a question nobody
   * can answer, for as long as the tab is open.
   */
  if (part.type === "tool-askBuyer" && onAnswer) {
    return <AskBuyerCard onAnswer={onAnswer} part={part} />;
  }

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
