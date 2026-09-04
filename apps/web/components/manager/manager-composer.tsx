"use client";

import { Pill } from "@workspace/ui/components/pill";
import { ArrowUp, Square } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback } from "react";

/**
 * The one solid red on this page.
 *
 * Everything else an operator can press is a ghost pill, because approving a
 * reorder is a decision and asking a question is not. Sending is the only
 * thing here that is purely additive, so it gets the fill.
 */

interface ManagerComposerProps {
  onSend: () => void;
  onStop: () => void;
  onValueChange: (value: string) => void;
  streaming: boolean;
  value: string;
}

function ManagerComposer({
  onSend,
  onStop,
  onValueChange,
  streaming,
  value,
}: ManagerComposerProps) {
  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value),
    [onValueChange]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  return (
    <div className="flex items-center gap-3 rounded-full border border-hairline bg-panel py-2 pr-2 pl-6">
      <input
        aria-label="Ask the manager assistant"
        className="t-body h-11 min-w-0 flex-1 bg-transparent text-bone outline-none placeholder:text-smoke"
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="Ask about any of this…"
        value={value}
      />

      <Pill
        aria-label={streaming ? "Stop" : "Send"}
        className="size-11 shrink-0 p-0"
        onClick={streaming ? onStop : onSend}
      >
        {streaming ? (
          <Square aria-hidden className="size-3.5 fill-current" />
        ) : (
          <ArrowUp aria-hidden className="size-4" />
        )}
      </Pill>
    </div>
  );
}

export { ManagerComposer };
