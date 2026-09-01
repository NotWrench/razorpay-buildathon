"use client";

import type { ReactNode } from "react";
import { ToolStatus } from "./primitives";
import { TextMessage } from "./text-message";
import { asToolPart, ToolPart, type ToolPartShape } from "./tool-part";

/**
 * The thread.
 *
 * Generic over the message type on purpose: the storefront and merchant agents
 * have different tool unions, and the only per-agent decision here is which
 * card a finished tool output becomes.
 */

interface ThreadMessage {
  id: string;
  parts: { type: string }[];
  role: string;
}

export function MessageThread<TMessage extends ThreadMessage>({
  busy,
  deniedNote,
  empty,
  messages,
  onApproval,
  pendingLabel,
  renderOutput,
}: {
  busy: boolean;
  deniedNote: string;
  empty: ReactNode;
  messages: TMessage[];
  onApproval: (response: { approved: boolean; id: string }) => void;
  pendingLabel: (type: string) => string;
  renderOutput: (part: ToolPartShape) => ReactNode;
}) {
  if (messages.length === 0) {
    return <>{empty}</>;
  }

  return (
    <>
      {messages.map((message) => (
        <div className="space-y-2" key={message.id}>
          {message.parts.map((part, index) => {
            const key = `${message.id}-${index}`;

            if (part.type === "text") {
              return (
                <TextMessage
                  key={key}
                  role={message.role}
                  text={(part as unknown as { text: string }).text}
                />
              );
            }

            const tool = asToolPart(part);

            if (!tool) {
              return null;
            }

            return (
              <ToolPart
                deniedNote={deniedNote}
                key={key}
                onApproval={onApproval}
                part={tool}
                pendingLabel={pendingLabel}
                renderOutput={renderOutput}
              />
            );
          })}
        </div>
      ))}

      {busy ? <ToolStatus>Thinking…</ToolStatus> : null}
    </>
  );
}
