"use client";

import type { MerchantMessage } from "@workspace/ai";
import { MerchantToolOutput } from "@/components/assistant/merchant/tool-output";
import { merchantPendingLabel } from "@/components/assistant/merchant/pending-labels";
import { MessageThread } from "@/components/assistant/message-thread";

/**
 * The manager's thread — the merchant agent, in the manager's room.
 *
 * Everything about how a tool call behaves on screen (streaming, the approval
 * gate, a denial, a turn that ended silently) is the shared state machine in
 * `MessageThread`; this only decides how it *looks* here. Which is: no
 * bubbles, no fills, and the same cards the tool outputs already draw — the
 * semantic tokens they use resolve to this room's palette, so a card is
 * panel-on-void without knowing it.
 *
 * The regex that used to answer here is gone. It could reply about sales,
 * stock and priorities and nothing else, and it refused every action with a
 * sentence about drafting that no longer described what the system does. The
 * agent behind this can pull twenty-two tools and stops for approval on the
 * five that move money.
 */
export function ManagerThread({
  busy,
  error,
  messages,
  onApproval,
  onRetry,
}: {
  busy: boolean;
  error?: Error;
  messages: MerchantMessage[];
  onApproval: (response: { approved: boolean; id: string }) => void;
  onRetry?: () => void;
}) {
  return (
    <div className="grid gap-6">
      <MessageThread
        busy={busy}
        deniedNote="You declined that, so nothing changed."
        empty={null}
        error={error}
        messages={messages}
        onApproval={onApproval}
        onRetry={onRetry}
        pendingLabel={merchantPendingLabel}
        renderOutput={(part) => <MerchantToolOutput part={part} />}
        textVariant="plain"
      />
    </div>
  );
}
