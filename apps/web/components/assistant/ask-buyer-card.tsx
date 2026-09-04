"use client";

import { stepFor } from "@workspace/ai/client";
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

/**
 * The choices that are actually ready to draw.
 *
 * A tool's input streams a token at a time, so the first few frames carry
 * half-built entries — a label still arriving, or an empty slot where the next
 * one will be. Drawing those gives blank buttons that answer nothing.
 *
 * Shorthand is a different matter and is drawn as-is: the model sends a bare
 * `"Gaming"` as readily as a `{label, value}` pair, and the tool's schema
 * accepts both. See `tools/requirements.ts`.
 */
function choicesOf(input: Record<string, unknown> | undefined): Choice[] {
  const raw = input?.choices;

  if (!Array.isArray(raw)) {
    return [];
  }

  const choices = raw as (string | { label?: string; value?: string } | null)[];

  return choices.flatMap((choice) => {
    if (typeof choice === "string") {
      return choice ? [{ label: choice, value: choice }] : [];
    }

    return choice?.label
      ? [{ label: choice.label, value: choice.value ?? choice.label }]
      : [];
  });
}

interface Range {
  max: number;
  min: number;
  step: number;
  unit?: string;
}

/**
 * The range, but only once every number in it has arrived.
 *
 * `input.range` is truthy the moment the opening brace streams, so without
 * this the slider mounts on `{min: 30000}` and takes its midpoint from an
 * undefined `max` — `₹NaN`, and frozen there, because a `useState` initial
 * value is read once and the rest of the range lands a frame later.
 */
function rangeOf(input: Record<string, unknown> | undefined): Range | null {
  const raw = input?.range as Partial<Range> | [number, number] | undefined;

  if (!raw) {
    return null;
  }

  /* `[low, high]` is shorthand the tool's schema accepts, so this must too. */
  const { max, min, step, unit } = Array.isArray(raw)
    ? {
        max: Math.max(...raw),
        min: Math.min(...raw),
        step: undefined,
        unit: undefined,
      }
    : raw;

  if (
    !(Number.isFinite(min) && Number.isFinite(max)) ||
    (max as number) <= (min as number)
  ) {
    return null;
  }

  const ends = { max: max as number, min: min as number };

  /*
   * A missing step is not a half-built range — the model routinely sends the
   * two ends alone, and the tool's schema fills the rest in with this same
   * default. See `tools/ask-buyer-schema.ts`.
   */
  return {
    ...ends,
    step:
      Number.isFinite(step) && (step as number) > 0
        ? (step as number)
        : stepFor(ends),
    unit,
  };
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
        {choices.map((choice, index) => (
          <OptionButton
            // biome-ignore lint/suspicious/noArrayIndexKey: position is the stable identity while the choices stream in
            key={`${index}-${choice.value}`}
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

/** The middle of the range, snapped to a step the slider can actually sit on. */
function midpoint(range: Range): number {
  return Math.round((range.min + range.max) / 2 / range.step) * range.step;
}

function RangeOption({
  onPick,
  range,
}: {
  onPick: (value: string) => void;
  range: Range;
}) {
  const unit = range.unit ?? "";

  /*
   * Null until the buyer moves it, rather than a number fixed at mount: the
   * range can still widen by a digit after the first render, and a frozen
   * initial value would keep showing the midpoint of a budget nobody offered.
   */
  const [picked, setPicked] = useState<number | null>(null);
  const value = picked ?? midpoint(range);

  const onInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setPicked(Number(event.target.value)),
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
  const range = rangeOf(input);

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
          {choices.map((choice, index) => (
            <OptionButton
              // biome-ignore lint/suspicious/noArrayIndexKey: same
              key={`${index}-${choice.value}`}
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

      {kind === "range" && range ? (
        <RangeOption onPick={answer} range={range} />
      ) : null}

      <p className="mt-3 text-muted-foreground text-xs">or type an answer</p>
    </ToolCard>
  );
}
