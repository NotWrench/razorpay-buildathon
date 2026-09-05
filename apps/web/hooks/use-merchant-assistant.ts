"use client";

import { useChat } from "@ai-sdk/react";
import type { MerchantMessage } from "@workspace/ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useRef } from "react";
import { useTurnInterruption } from "./use-turn-interruption";

/**
 * The operations agent.
 *
 * Same approval mechanics as the storefront — activating a campaign or
 * approving an agent order both move money, so both stop for the merchant. The
 * merchant id is sent for routing only; the route re-checks store ownership
 * against the session before any tool runs.
 */
export function useMerchantAssistant({
  merchantId,
  rangeDays,
}: {
  merchantId: string;
  /** The window the briefing above the thread is showing. */
  rangeDays?: number;
}) {
  const conversationId = useRef<string | undefined>(undefined);

  /*
   * The range changes when the merchant picks another window, and `useChat`
   * captures `prepareSendMessagesRequest` once. Reading it out of a ref means
   * the next turn carries the window they are actually looking at rather than
   * the one that was open when the component first mounted.
   */
  const range = useRef(rangeDays);

  range.current = rangeDays;

  const { clear, interruption, noteFinish } = useTurnInterruption();

  const chat = useChat<MerchantMessage>({
    onFinish: noteFinish,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({
      api: "/api/agent/merchant",
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const id = response.headers.get("x-conversation-id");

        if (id) {
          conversationId.current = id;
        }

        return response;
      },
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          conversationId: conversationId.current,
          merchantId,
          messages,
          rangeDays: range.current,
        },
      }),
    }),
  });

  return {
    ...chat,
    busy: chat.status === "streaming" || chat.status === "submitted",
    error: chat.error ?? interruption,
    sendMessage: (...args: Parameters<typeof chat.sendMessage>) => {
      clear();

      return chat.sendMessage(...args);
    },
  };
}
