"use client";

import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useState } from "react";
import { ToolCard } from "./primitives";

/**
 * A question from the model, in the panel surfaces.
 *
 * The same tool as the full-page assistant renders, in the other design
 * language. It is a separate component rather than a shared one with a theme
 * prop because the two surfaces do not share a palette: the full-page
 * assistant is painted in fixed dark tokens, and the dock and dashboard follow
 * the reader's light or dark theme. A single component would have to be
 * right in three colour schemes at once, and the honest version of that is two
 * small components that are each right in one.
 *
 * What both share is the rule that matters: the composer stays live, so the
 * options are an offer and never a gate.
 */

interface AskBuyerCardProps {
  onAnswer: (toolCallId: string, value: string) => void;
  part: {
    input?: Record<string, unknown>;
    output?: unknown;
    state: string;
    toolCallId?: string;
  };
}

interface Choice {
  label: string;
  value: string;
}

/** Chosen alone or not at all. */
const EXCLUSIVE = /^(nothing|none|no)$/i;

function choicesOf(input: Record<string, unknown> | undefined): Choice[] {
  const raw = input?.choices;

  return Array.isArray(raw) ? (raw as Choice[]) : [];
}

function OptionButton({
  label,
  onPick,
  picked,
  value,
}: {
  label: string;
  onPick: (value: string) => void;
  picked?: boolean;
  value: string;
}) {
  const handleClick = useCallback(() => onPick(value), [onPick, value]);

  return (
    <button
      aria-pressed={picked}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        picked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      )}
      onClick={handleClick}
      type="button"
    >
      {label}
    </button>
  );
}

function MultiOptions({
  choices,
  onPick,
}: {
  choices: Choice[];
  onPick: (value: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = useCallback((value: string) => {
    setPicked((current) => {
      if (EXCLUSIVE.test(value)) {
        return [value];
      }

      const without = current.filter((entry) => !EXCLUSIVE.test(entry));

      return without.includes(value)
        ? without.filter((entry) => entry !== value)
        : [...without, value];
    });
  }, []);

  const confirm = useCallback(
    () => onPick(picked.length > 0 ? picked.join(", ") : "Nothing"),
    [onPick, picked]
  );

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <OptionButton
            key={choice.value}
            label={choice.label}
            onPick={toggle}
            picked={picked.includes(choice.value)}
            value={choice.value}
          />
        ))}
      </div>
      <button
        className="mt-3 rounded-sm border border-border px-2 py-1 font-medium text-xs hover:bg-muted"
        onClick={confirm}
        type="button"
      >
        Done
      </button>
    </>
  );
}

function RangeOption({
  onPick,
  range,
}: {
  onPick: (value: string) => void;
  range: { max: number; min: number; step: number; unit?: string };
}) {
  const unit = range.unit ?? "";
  const [value, setValue] = useState(
    Math.round((range.min + range.max) / 2 / range.step) * range.step
  );

  const onInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValue(Number(event.target.value)),
    []
  );

  const confirm = useCallback(
    () => onPick(`${unit}${value.toLocaleString("en-IN")}`),
    [onPick, unit, value]
  );

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <input
          aria-label="Answer"
          className="h-1 flex-1 accent-primary"
          max={range.max}
          min={range.min}
          onChange={onInput}
          step={range.step}
          type="range"
          value={value}
        />
        <span className="w-24 text-right font-mono text-xs tabular-nums">
          {unit}
          {value.toLocaleString("en-IN")}
        </span>
      </div>
      <button
        className="mt-3 rounded-sm border border-border px-2 py-1 font-medium text-xs hover:bg-muted"
        onClick={confirm}
        type="button"
      >
        That&rsquo;s it
      </button>
    </div>
  );
}

export function AskBuyerCard({ onAnswer, part }: AskBuyerCardProps) {
  const callId = part.toolCallId ?? "";

  const answer = useCallback(
    (value: string) => onAnswer(callId, value),
    [callId, onAnswer]
  );

  const { input } = part;
  const prompt = typeof input?.prompt === "string" ? input.prompt.trim() : "";
  const kind = input?.kind;
  const choices = choicesOf(input);

  if (part.state === "output-available") {
    return (
      <ToolCard title={String(input?.label ?? "Answer")}>
        <p className="text-foreground">{String(part.output ?? "")}</p>
      </ToolCard>
    );
  }

  /* The input streams a token at a time; there is nothing to answer yet. */
  if (!prompt) {
    return null;
  }

  return (
    <ToolCard>
      <p className="text-foreground">{prompt}</p>

      {kind === "choice" && choices.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {choices.map((choice) => (
            <OptionButton
              key={choice.value}
              label={choice.label}
              onPick={answer}
              value={choice.value}
            />
          ))}
        </div>
      ) : null}

      {kind === "multi" && choices.length > 0 ? (
        <MultiOptions choices={choices} onPick={answer} />
      ) : null}

      {kind === "range" && input?.range ? (
        <RangeOption
          onPick={answer}
          range={
            input.range as {
              max: number;
              min: number;
              step: number;
              unit?: string;
            }
          }
        />
      ) : null}

      <p className="mt-3 text-muted-foreground text-xs">or type an answer</p>
    </ToolCard>
  );
}
