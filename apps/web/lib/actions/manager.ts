"use server";

import type { ManagerReply } from "@/lib/data/manager-chat";
import { managerReply } from "@/lib/data/manager-chat";

/**
 * The manager's composer, from the client.
 *
 * The summary above it is rendered on the server; the follow-up has to cross
 * back over, because the answer is another query over the same window. See
 * `lib/data/manager-chat.ts` for why it is a query and not a model call.
 */

const MAX_QUESTION = 500;
const MAX_RANGE = 16;

export async function managerReplyAction(
  question: string,
  rangeId?: string
): Promise<ManagerReply> {
  const asked =
    typeof question === "string" ? question.slice(0, MAX_QUESTION) : "";
  const range =
    typeof rangeId === "string" ? rangeId.slice(0, MAX_RANGE) : undefined;

  return await managerReply(asked, range);
}
