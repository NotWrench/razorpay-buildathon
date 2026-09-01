"use client";

import { useMerchantAssistant } from "@/hooks/use-merchant-assistant";
import { ChatShell } from "../chat-shell";
import { Composer } from "../composer";
import { MessageThread } from "../message-thread";
import { SuggestionList } from "../suggestion-list";
import { merchantPendingLabel } from "./pending-labels";
import { MerchantToolOutput } from "./tool-output";

/**
 * The merchant's assistant.
 *
 * Same shell and same approval gate as the storefront; what differs is the
 * tool set behind it and the cards its answers become.
 */

const SUGGESTIONS = [
  "How is the store doing?",
  "What is not selling?",
  "Any orders waiting for me?",
  "What should I reorder this week?",
] as const;

export function MerchantAssistant({ merchantId }: { merchantId: string }) {
  const { addToolApprovalResponse, busy, messages, sendMessage } =
    useMerchantAssistant({ merchantId });

  return (
    <ChatShell
      composer={
        <Composer
          busy={busy}
          onSend={(text) => sendMessage({ text })}
          placeholder="Ask about your store…"
        />
      }
      streaming={busy}
    >
      <MessageThread
        busy={busy}
        deniedNote="You declined that, so nothing changed."
        empty={
          <div className="space-y-3 py-6">
            <p className="text-muted-foreground text-sm">
              Ask about the business. I pull the numbers before I answer, and I
              never activate anything without you.
            </p>
            <SuggestionList
              onPick={(text) => sendMessage({ text })}
              suggestions={SUGGESTIONS}
            />
          </div>
        }
        messages={messages}
        onApproval={addToolApprovalResponse}
        pendingLabel={merchantPendingLabel}
        renderOutput={(part) => <MerchantToolOutput part={part} />}
      />
    </ChatShell>
  );
}
