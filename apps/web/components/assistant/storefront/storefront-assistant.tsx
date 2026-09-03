"use client";

import type { ChatMode, PageContextInput } from "@workspace/ai";
import { useRazorpay } from "@/hooks/use-razorpay";
import { useStorefrontAssistant } from "@/hooks/use-storefront-assistant";
import { ChatShell } from "../chat-shell";
import { Composer } from "../composer";
import { MessageThread } from "../message-thread";
import { ModeTabs } from "../mode-tabs";
import { SuggestionList } from "../suggestion-list";
import { storefrontPendingLabel } from "./pending-labels";
import { StorefrontToolOutput } from "./tool-output";

/**
 * The buyer-facing assistant.
 *
 * It is handed the page it was opened from, so "will this fit my case?" on a
 * product page has a referent without the buyer restating anything. Structured
 * output is rendered as cards, and every money action arrives as an approval
 * card — until that card is answered the tool has not run.
 */

const SUGGESTIONS = [
  "Build me a gaming PC for ₹80,000",
  "Will this fit in a mid-tower case?",
  "Compare these two graphics cards",
] as const;

export function StorefrontAssistant({
  context,
  initialMode,
  showModes = true,
  slug,
  storeName,
}: {
  context?: PageContextInput;
  initialMode?: ChatMode;
  showModes?: boolean;
  slug: string;
  storeName: string;
}) {
  const {
    addToolApprovalResponse,
    busy,
    error,
    messages,
    mode,
    regenerate,
    sendMessage,
    setMode,
  } = useStorefrontAssistant({ context, initialMode, slug });

  const { open, paying } = useRazorpay();

  return (
    <ChatShell
      composer={
        <Composer
          busy={busy}
          onSend={(text) => sendMessage({ text })}
          placeholder="What are you looking for?"
        />
      }
      header={
        showModes ? <ModeTabs mode={mode} onChange={setMode} /> : undefined
      }
      streaming={busy}
    >
      <MessageThread
        busy={busy}
        deniedNote="You declined that, so nothing happened."
        error={error}
        onRetry={regenerate}
        empty={
          <div className="space-y-3 py-6">
            <p className="text-muted-foreground text-sm">
              Tell me what you need and I&apos;ll find it in this shop.
              I&apos;ll always show you the full price before anything is
              ordered.
            </p>
            <SuggestionList
              onPick={(text) => sendMessage({ text })}
              suggestions={SUGGESTIONS}
            />
          </div>
        }
        messages={messages}
        onApproval={addToolApprovalResponse}
        pendingLabel={storefrontPendingLabel}
        renderOutput={(part) => (
          <StorefrontToolOutput
            handlers={{
              onPay: (handoff, orderId) =>
                open({
                  handoff,
                  onSettled: (settled) =>
                    sendMessage({
                      text: settled
                        ? `I completed the payment for order ${orderId}.`
                        : `I closed the payment window for order ${orderId}. What happened?`,
                    }),
                  orderId,
                  storeName,
                }),
              onSend: (text) => sendMessage({ text }),
              payingOrder: paying,
              slug,
            }}
            part={part}
          />
        )}
      />
    </ChatShell>
  );
}
