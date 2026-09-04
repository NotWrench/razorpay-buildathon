"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { StreamedText } from "@/components/chat/streamed-text";
import { PillLink } from "@/components/common/pill-link";
import { DockResultView } from "@/components/dock/dock-results";
import type { DockResult, DockTool } from "@/lib/data/dock";
import { route } from "@/lib/routes";

/**
 * The thread. No bubbles — no borders, no fills, no tails.
 *
 * A bubble is a container for a message that has nothing else to sit in. These
 * turns have plenty: the user's are right-aligned in smoke, the assistant's
 * left-aligned in bone with a sparkle. Alignment and colour carry the speaker.
 */

export interface DockTurn {
  beyond?: boolean;
  id: string;
  result?: DockResult;
  role: "user" | "assistant";
  /** Words already revealed. The rest arrive one at a time. */
  shown: number;
  text: string;
  tool?: DockTool;
}

function ToolLine({ tool }: { tool: DockTool }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  return (
    <div className="mt-3">
      <button
        aria-expanded={open}
        className="t-num-xs flex items-center gap-1.5 text-smoke transition-colors duration-micro hover:text-bone"
        onClick={toggle}
        type="button"
      >
        {tool.label}
        {tool.rules ? ` · ${tool.rules} rules` : ""}
        <ChevronDown
          aria-hidden
          className="size-3 transition-transform duration-exit"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open ? (
        <dl className="mt-2 border-hairline border-t pt-2">
          {Object.entries(tool.args).map(([key, value]) => (
            <div className="flex gap-3 py-0.5" key={key}>
              <Label as="dt" className="w-20 shrink-0">
                {key}
              </Label>
              <dd className="t-num-xs text-smoke">{value}</dd>
            </div>
          ))}
          <div className="flex gap-3 py-0.5">
            <Label as="dt" className="w-20 shrink-0">
              result
            </Label>
            <dd className="t-num-xs text-smoke">{tool.result}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

function Turn({ streaming, turn }: { streaming: boolean; turn: DockTurn }) {
  if (turn.role === "user") {
    return (
      <p className="t-body-sm pl-8 text-right text-smoke">{turn.text}</p>
    );
  }

  const done = turn.shown >= turn.text.split(" ").length;

  return (
    <div className="flex gap-2.5 pr-6">
      <Sparkles aria-hidden className="mt-1 size-3.5 shrink-0 text-smoke" />
      <div className="min-w-0 flex-1">
        <StreamedText
          className="t-body-sm leading-relaxed"
          id={turn.id}
          shown={turn.shown}
          streaming={streaming}
          text={turn.text}
        />

        {done && turn.tool ? <ToolLine tool={turn.tool} /> : null}
        {done && turn.result ? <DockResultView result={turn.result} /> : null}

        {done && turn.beyond ? (
          <PillLink
            className="mt-3 px-0"
            href={route("/assistant")}
            variant="text"
          >
            Open full assistant →
          </PillLink>
        ) : null}
      </div>
    </div>
  );
}

function DockThread({
  streaming,
  turns,
}: {
  streaming: boolean;
  turns: DockTurn[];
}) {
  return (
    <div
      aria-busy={streaming}
      aria-live="polite"
      className={cn("flex flex-col gap-5")}
    >
      {turns.map((turn) => (
        <Turn key={turn.id} streaming={streaming} turn={turn} />
      ))}
    </div>
  );
}

export { DockThread };
