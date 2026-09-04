"use client";

import { Menu } from "@base-ui/react/menu";
import type { ChatMode } from "@workspace/ai";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowUp, ChevronDown, Square } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { forwardRef, useCallback } from "react";

/**
 * The composer, live from the first frame to the last.
 *
 * It never disables itself during the interview: the whole reason the
 * questions are asked in the thread rather than in a modal is that someone can
 * ignore them and say what they actually want.
 */

const MODES = [
  { id: "build", label: "Build" },
  { id: "compare", label: "Compare" },
  { id: "recommend", label: "Recommend" },
  { id: "about", label: "About" },
  { id: "orders", label: "Orders" },
] as const satisfies readonly { id: ChatMode; label: string }[];

/**
 * The same five tasks §6 defines, not a second list that looks like them.
 *
 * The mode travels with every turn and decides which tools the agent may
 * reach, so a label here that the server has never heard of is a mode that
 * silently narrows to nothing.
 */
export type ChatModeId = ChatMode;

interface ChatComposerProps {
  mode: ChatModeId;
  onEditLast?: () => void;
  onModeChange: (mode: ChatModeId) => void;
  onSend: () => void;
  onStop: () => void;
  onValueChange: (value: string) => void;
  streaming: boolean;
  value: string;
}

function ModeItem({
  id,
  label,
  onModeChange,
}: {
  id: ChatModeId;
  label: string;
  onModeChange: (mode: ChatModeId) => void;
}) {
  const handleClick = useCallback(() => onModeChange(id), [id, onModeChange]);

  return (
    <Menu.Item
      className="t-body rounded-[16px] px-4 py-2.5 text-bone outline-none transition-colors duration-micro data-highlighted:bg-riser"
      onClick={handleClick}
    >
      {label}
    </Menu.Item>
  );
}

const ChatComposer = forwardRef<HTMLTextAreaElement, ChatComposerProps>(
  function Composer(
    {
      mode,
      onEditLast,
      onModeChange,
      onSend,
      onStop,
      onValueChange,
      streaming,
      value,
    },
    ref
  ) {
    const onChange = useCallback(
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        onValueChange(event.target.value);

        const field = event.target;

        field.style.height = "auto";
        field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
      },
      [onValueChange]
    );

    const onKeyDown = useCallback(
      (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onSend();

          return;
        }

        /* ↑ on an empty field pulls the last thing you said back for editing. */
        if (event.key === "ArrowUp" && value === "" && onEditLast) {
          event.preventDefault();
          onEditLast();

          return;
        }

        if (event.key === "Escape" && streaming) {
          event.preventDefault();
          onStop();
        }
      },
      [onEditLast, onSend, onStop, streaming, value]
    );

    const modeLabel =
      MODES.find((entry) => entry.id === mode)?.label ?? "Build";

    return (
      <div className="flex min-h-[60px] items-center gap-4 rounded-full border border-hairline bg-panel px-5 py-2.5">
        <Menu.Root>
          <Menu.Trigger className="t-body flex shrink-0 items-center gap-1.5 text-smoke transition-colors duration-micro hover:text-bone data-popup-open:text-bone">
            {modeLabel}
            <ChevronDown aria-hidden className="size-3.5" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner align="start" side="top" sideOffset={12}>
              <Menu.Popup className="w-[200px] rounded-[28px] bg-panel p-2 shadow-float outline-none">
                {MODES.map((entry) => (
                  <ModeItem
                    id={entry.id}
                    key={entry.id}
                    label={entry.label}
                    onModeChange={onModeChange}
                  />
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <span aria-hidden className="h-6 w-px shrink-0 bg-hairline" />

        <textarea
          aria-label="Message"
          className={cn(
            "t-body max-h-[120px] min-h-6 flex-1 resize-none bg-transparent text-bone",
            "placeholder:text-smoke focus:outline-none"
          )}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Describe what you need…"
          ref={ref}
          rows={1}
          value={value}
        />

        <button
          aria-label={streaming ? "Stop" : "Send"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lacquer text-white transition-colors duration-micro hover:bg-ember"
          onClick={streaming ? onStop : onSend}
          type="button"
        >
          {streaming ? (
            <Square aria-hidden className="size-3 fill-current" />
          ) : (
            <ArrowUp aria-hidden className="size-4" />
          )}
        </button>
      </div>
    );
  }
);

export { ChatComposer, MODES };
