"use client";

import type { ReactNode } from "react";
import { ToolCard, ToolStatus } from "./primitives";
import { ReasoningNote } from "./reasoning-note";
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
  error,
  messages,
  onApproval,
  onRetry,
  pendingLabel,
  renderOutput,
}: {
  busy: boolean;
  deniedNote: string;
  empty: ReactNode;
  /** A turn that ended badly. In practice never set while `busy` is true. */
  error?: Error;
  messages: TMessage[];
  onApproval: (response: { approved: boolean; id: string }) => void;
  onRetry?: () => void;
  pendingLabel: (type: string) => string;
  renderOutput: (part: ToolPartShape) => ReactNode;
}) {
  if (messages.length === 0) {
    return <>{empty}</>;
  }

  const last = messages.at(-1);

  /**
   * True when the assistant's turn is over and left nothing on screen.
   *
   * Not every part renders: a message can be nothing but `getRequirements` and
   * `captureRequirements` calls, neither of which becomes a card, and a turn
   * cut short before the model wrote any text produces exactly that. The
   * result is a spinner that disappears and no reply — which reads as the app
   * losing the answer rather than the turn ending early.
   */
  const settled = !(busy || error);
  const silent =
    settled &&
    last?.role === "assistant" &&
    !last.parts.some((part) => part.type === "text");

  return (
    <>
      {messages.map((message) => (
        <div className="space-y-2" key={message.id}>
          {message.parts.map((part, index) => {
            const key = `${message.id}-${index}`;

            if (part.type === "reasoning") {
              return (
                <ReasoningNote
                  key={key}
                  text={(part as unknown as { text: string }).text}
                />
              );
            }

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

      {silent ? (
        <ToolCard tone="warning">
          <p>
            The assistant stopped before it wrote a reply. Nothing was charged.
          </p>
          {onRetry ? (
            <button
              className="mt-2 rounded-sm border border-border px-2 py-1 font-medium text-xs hover:bg-muted"
              onClick={onRetry}
              type="button"
            >
              Try again
            </button>
          ) : null}
        </ToolCard>
      ) : null}

      {/*
        A failed turn has to say so. The only end-of-turn signal this thread
        had was `busy` going false, and an error that never reaches the client
        never flips it — so a stalled turn showed "Thinking…" indefinitely.
        An error nobody is shown is an error nobody retries.
      */}
      {error && !busy ? (
        <ToolCard tone="danger">
          <p>{error.message}</p>
          {onRetry ? (
            <button
              className="mt-2 rounded-sm border border-border px-2 py-1 font-medium text-xs hover:bg-muted"
              onClick={onRetry}
              type="button"
            >
              Try again
            </button>
          ) : null}
        </ToolCard>
      ) : null}
    </>
  );
}
