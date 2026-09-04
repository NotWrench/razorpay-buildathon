"use client";

import { stepFor } from "@workspace/ai/client";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { Sparkles } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback, useRef, useState } from "react";

/**
 * A question the model asked, rendered as something you can tap.
 *
 * The wording, the options and the order are the model's — this file only
 * decides what a question looks like. That is the whole change: the question
 * set used to be a fixed array of five in the browser, so a buyer who wanted a
 * machine for flight simulation was asked about refresh rate and never asked
 * the one question that mattered.
 *
 * Never a popup and never a modal. An interview that interrupts the
 * conversation to collect an answer is a form wearing a chat's clothes, and it
 * throws away the one thing a thread is good at — letting the person answer
 * something else, or nothing, and carry on. The composer stays live throughout,
 * which is what the "or type an answer" rule underneath every question means.
 */

export interface AskBuyerInput {
  choices?: (string | { label?: string; value?: string } | null)[] | null;
  field?: string;
  kind?: "choice" | "multi" | "range";
  label?: string;
  prompt?: string;
  range?:
    | [number, number]
    | { max?: number; min?: number; step?: number; unit?: string };
}

/** Chosen alone or not at all — "nothing", "none", and the like. */
const EXCLUSIVE = /^(nothing|none|no)$/i;

interface Choice {
  label: string;
  value: string;
}

/**
 * The choices that are actually ready to draw.
 *
 * A tool's input streams in a token at a time, so for the first few frames
 * `choices` holds half-built entries — a label still arriving, or an empty
 * slot where the next one will be. Rendering those gives blank pills that
 * answer nothing, so anything without a label is held back. That wait costs a
 * few hundred milliseconds and is invisible; the alternative is not.
 *
 * What is *not* held back is a choice the model wrote in shorthand. It sends
 * a bare `"Gaming"` as often as a `{label, value}` pair, and both mean the
 * same thing — the tool's schema reads either, so this has to as well, or the
 * question arrives with nothing to tap. See `tools/requirements.ts`.
 */
function readyChoices(input: AskBuyerInput): Choice[] {
  const choices = input.choices ?? [];

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
 * this the slider mounts on `{min: 30000}` and computes its midpoint from an
 * undefined `max` — `₹NaN`, frozen there for good, because the initial value
 * of a `useState` is read once and the rest of the range lands a frame later.
 * A partly-streamed number is the same hazard in slower motion: `150` is a
 * valid number on the way to `150000`.
 */
function readyRange(range: AskBuyerInput["range"]): Range | null {
  if (!range) {
    return null;
  }

  /* `[low, high]` is shorthand the tool's schema accepts, so this must too. */
  const { max, min, step, unit } = Array.isArray(range)
    ? {
        max: Math.max(...range),
        min: Math.min(...range),
        step: undefined,
        unit: undefined,
      }
    : range;

  if (
    !(Number.isFinite(min) && Number.isFinite(max)) ||
    Number(max) <= Number(min)
  ) {
    return null;
  }

  const ends = { max: Number(max), min: Number(min) };

  /*
   * A missing step is not a half-built range — the model routinely sends the
   * two ends and nothing else, and the tool's schema fills the rest in. The
   * same default is used here so the slider does not shift under the buyer
   * when the validated input replaces the streamed one.
   */
  return {
    ...ends,
    step:
      Number.isFinite(step) && Number(step) > 0 ? Number(step) : stepFor(ends),
    unit,
  };
}

function ChoiceRow({
  choices,
  onPick,
}: {
  choices: Choice[];
  onPick: (value: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);

  /* Arrow keys walk the row; the pills are the answer, so they behave like one
     control rather than five unrelated buttons. */
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    const buttons = [...(row.current?.querySelectorAll("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);

    if (at === -1) {
      return;
    }

    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;

    buttons[(at + step + buttons.length) % buttons.length]?.focus();
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a delegate for the pills inside it
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same
    <div className="mt-5 flex flex-wrap gap-3" onKeyDown={onKeyDown} ref={row}>
      {choices.map((choice, index) => (
        <ChoicePill
          delay={index * 40}
          // biome-ignore lint/suspicious/noArrayIndexKey: the list only ever grows by append while the input streams, and two options may legitimately share a value
          key={`${index}-${choice.value}`}
          label={choice.label}
          onPick={onPick}
          value={choice.value}
        />
      ))}
    </div>
  );
}

function ChoicePill({
  delay,
  label,
  onPick,
  value,
}: {
  delay: number;
  label: string;
  onPick: (value: string) => void;
  value: string;
}) {
  const handleClick = useCallback(() => onPick(value), [onPick, value]);

  return (
    <Pill
      className="stream-word"
      onClick={handleClick}
      size="sm"
      style={{ animationDelay: `${delay}ms` }}
      variant="ghost"
    >
      {label}
    </Pill>
  );
}

/** The middle of the range, snapped to a step the slider can actually sit on. */
function midpoint(range: Range): number {
  return Math.round((range.min + range.max) / 2 / range.step) * range.step;
}

function RangeAnswer({
  onPick,
  range,
}: {
  onPick: (value: string) => void;
  range: Range;
}) {
  const unit = range.unit ?? "";

  /*
   * Null until the buyer moves it, rather than a number fixed at mount. The
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
    <div className="mt-5">
      <div className="flex items-center gap-5">
        <input
          aria-label="Answer"
          className="h-1 flex-1 appearance-none rounded-full bg-hairline accent-bone"
          max={range.max}
          min={range.min}
          onChange={onInput}
          step={range.step}
          type="range"
          value={value}
        />
        <span className="w-28 text-right font-mono text-[15px] text-bone tabular-nums">
          {unit}
          {value.toLocaleString("en-IN")}
        </span>
      </div>
      <Pill className="mt-4" onClick={confirm} size="sm" variant="ghost">
        That&rsquo;s it
      </Pill>
    </div>
  );
}

function MultiAnswer({
  choices,
  onPick,
}: {
  choices: Choice[];
  onPick: (value: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);

  /*
   * "Nothing" is exclusive: picking it clears the rest, and picking any of the
   * rest clears it. Matched on the value rather than hardcoded, because the
   * model writes these labels now and will not always spell it the same way.
   */
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
    <div className="mt-5">
      <div className="flex flex-wrap gap-3">
        {choices.map((choice, index) => (
          <MultiPill
            // biome-ignore lint/suspicious/noArrayIndexKey: same — position is the stable identity while the choices stream in
            key={`${index}-${choice.value}`}
            label={choice.label}
            onToggle={toggle}
            picked={picked.includes(choice.value)}
            value={choice.value}
          />
        ))}
      </div>
      <Pill className="mt-4" onClick={confirm} size="sm" variant="ghost">
        Done
      </Pill>
    </div>
  );
}

function MultiPill({
  label,
  onToggle,
  picked,
  value,
}: {
  label: string;
  onToggle: (value: string) => void;
  picked: boolean;
  value: string;
}) {
  const handleClick = useCallback(() => onToggle(value), [onToggle, value]);

  return (
    <button
      aria-pressed={picked}
      className={cn(
        "h-9 rounded-full border px-4 text-[13px] transition-colors duration-[180ms]",
        picked
          ? "border-bone bg-bone text-void"
          : "border-hairline text-smoke hover:border-smoke hover:text-bone"
      )}
      onClick={handleClick}
      type="button"
    >
      {label}
    </button>
  );
}

/**
 * The question, while it is still open.
 *
 * Everything below the prompt is defensive about what the model sent. A
 * `choice` with no choices, a `range` with no range — both are a malformed
 * tool call, and neither should cost the buyer the question. What survives is
 * the prompt and the invitation to type, which is a working conversation
 * rather than a broken widget.
 */
export function AskBuyerQuestion({
  input,
  onAnswer,
}: {
  input: AskBuyerInput;
  onAnswer: (value: string) => void;
}) {
  const choices = readyChoices(input);
  const range = readyRange(input.range);
  const prompt = input.prompt?.trim();

  /* The prompt streams in a token at a time; there is nothing to answer yet. */
  if (!prompt) {
    return null;
  }

  return (
    <div className="flex gap-3">
      <Sparkles aria-hidden className="mt-1.5 size-4 shrink-0 text-smoke" />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] text-bone leading-relaxed">{prompt}</p>

        {input.kind === "choice" && choices.length > 0 ? (
          <ChoiceRow choices={choices} onPick={onAnswer} />
        ) : null}
        {input.kind === "multi" && choices.length > 0 ? (
          <MultiAnswer choices={choices} onPick={onAnswer} />
        ) : null}
        {input.kind === "range" && range ? (
          <RangeAnswer onPick={onAnswer} range={range} />
        ) : null}

        <div className="mt-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-[13px] text-smoke">or type an answer</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>
      </div>
    </div>
  );
}

/**
 * The answered form: one quiet row.
 *
 * This is the detail that stops an interview leaving a graveyard of dead
 * widgets in the thread. There is no Edit here and there does not need to be —
 * the model is holding the conversation, so changing your mind is a sentence
 * rather than a control.
 */
export function AnsweredQuestion({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="answered-row flex items-baseline gap-6 border-hairline border-b py-3">
      <Label className="w-32 shrink-0">{label}</Label>
      <span className="flex-1 font-mono text-[15px] text-bone tabular-nums">
        {value}
      </span>
    </div>
  );
}
