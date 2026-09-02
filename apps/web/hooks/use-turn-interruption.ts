"use client";

import { useCallback, useState } from "react";

/**
 * A turn that stopped without finishing and without erroring.
 *
 * The agent's deadline (`AGENT_TURN_BUDGET_MS`) closes the stream with an
 * abort part rather than an error, and a dropped connection ends it with
 * nothing at all. Neither sets `error` on the chat, so both used to leave the
 * thread with a half-written answer and no indication that anything had gone
 * wrong — the same silence that made a stalled turn look like a working one.
 *
 * Neither assistant offers a stop button, so an abort seen here is always the
 * server giving up rather than the buyer.
 */

const STOPPED =
  "The assistant was taking too long and stopped partway. The model provider is slow or queueing right now — try that again.";

const DISCONNECTED =
  "The connection dropped partway through that answer. Nothing was charged. Try again.";

export function useTurnInterruption() {
  const [interruption, setInterruption] = useState<Error | undefined>(
    undefined
  );

  const noteFinish = useCallback(
    ({
      isAbort,
      isDisconnect,
    }: {
      isAbort?: boolean;
      isDisconnect?: boolean;
    }) => {
      if (isAbort) {
        setInterruption(new Error(STOPPED));
        return;
      }

      if (isDisconnect) {
        setInterruption(new Error(DISCONNECTED));
        return;
      }

      setInterruption(undefined);
    },
    []
  );

  const clear = useCallback(() => setInterruption(undefined), []);

  return { clear, interruption, noteFinish };
}
