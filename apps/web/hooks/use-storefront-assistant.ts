"use client";

import { useChat } from "@ai-sdk/react";
import type {
  ChatMode,
  PageContextInput,
  StorefrontMessage,
} from "@workspace/ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useRef, useState } from "react";

/**
 * The shopping agent, wired to the page it was opened from.
 *
 * Two things travel with every turn beyond the messages: the §6 mode, which
 * narrows the tools the agent may reach, and the §7 page context, which gives
 * "is this one any good?" a referent. Both are held in refs so changing the
 * mode mid-thread affects the next turn without re-creating the transport and
 * losing the conversation.
 *
 * The context ids are client-supplied and are re-read server-side under the
 * buyer's own scope; anything that does not resolve is dropped there.
 */

export interface StorefrontAssistantOptions {
  context?: PageContextInput;
  initialMode?: ChatMode;
  slug: string;
}

export function useStorefrontAssistant({
  context,
  initialMode,
  slug,
}: StorefrontAssistantOptions) {
  const conversationId = useRef<string | undefined>(undefined);
  const [mode, setMode] = useState<ChatMode | undefined>(initialMode);

  const modeRef = useRef(mode);
  const contextRef = useRef(context);

  modeRef.current = mode;
  contextRef.current = context;

  const chat = useChat<StorefrontMessage>({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({
      api: "/api/agent/chat",
      // The conversation id comes back on a response header, so one shopping
      // session stays one thread in the audit trail.
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
          context: contextRef.current,
          conversationId: conversationId.current,
          messages,
          mode: modeRef.current,
          slug,
        },
      }),
    }),
  });

  return {
    ...chat,
    busy: chat.status === "streaming" || chat.status === "submitted",
    mode,
    setMode,
  };
}
