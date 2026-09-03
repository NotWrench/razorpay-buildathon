"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { Sparkles } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { StreamedText } from "@/components/chat/streamed-text";
import type { InterviewQuestion } from "@/lib/assistant/interview";

/**
 * One question, asked in the thread as an ordinary message.
 *
 * Never a popup and never a modal: an interview that interrupts the
 * conversation to collect an answer is a form wearing a chat's clothes, and it
 * throws away the one thing a thread is good at — letting the person answer
 * something else, or nothing, and carry on.
 *
 * The composer stays live throughout, which is what the "or type an answer"
 * rule underneath every question is telling you.
 */

interface AskingProps {
  onAnswer: (questionId: string, value: string) => void;
  question: InterviewQuestion;
  shown: number;
  streaming: boolean;
}

function ChoiceRow({
  choices,
  onPick,
}: {
  choices: { label: string; value: string }[];
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
          key={choice.value}
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

function RangeAnswer({
  onPick,
  question,
}: {
  onPick: (value: string) => void;
  question: InterviewQuestion;
}) {
  const range = question.range ?? { max: 100, min: 0, step: 1 };
  const [value, setValue] = useState(
    Math.round((range.min + range.max) / 2 / range.step) * range.step
  );

  const onInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValue(Number(event.target.value)),
    []
  );

  const confirm = useCallback(() => onPick(String(value)), [onPick, value]);

  return (
    <div className="mt-5">
      <div className="flex items-center gap-5">
        <input
          aria-label={question.label}
          className="h-1 flex-1 appearance-none rounded-full bg-hairline accent-bone"
          max={range.max}
          min={range.min}
          onChange={onInput}
          step={range.step}
          type="range"
          value={value}
        />
        <span className="w-28 text-right font-mono text-[15px] text-bone tabular-nums">
          ₹{value.toLocaleString("en-IN")}
        </span>
      </div>
      <Pill className="mt-4" onClick={confirm} size="sm" variant="ghost">
        That&rsquo;s my budget
      </Pill>
    </div>
  );
}

function MultiAnswer({
  choices,
  onPick,
}: {
  choices: { label: string; value: string }[];
  onPick: (value: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);

  /* "Nothing" is exclusive: picking it clears the rest, and picking any of
     the rest clears it. */
  const toggle = useCallback((value: string) => {
    setPicked((current) => {
      if (value === "Nothing") {
        return ["Nothing"];
      }

      const without = current.filter((entry) => entry !== "Nothing");

      return without.includes(value)
        ? without.filter((entry) => entry !== value)
        : [...without, value];
    });
  }, []);

  const confirm = useCallback(
    () => onPick(picked.length ? picked.join(", ") : "Nothing"),
    [onPick, picked]
  );

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-3">
        {choices.map((choice) => (
          <MultiPill
            key={choice.value}
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

function AskingQuestion({ onAnswer, question, shown, streaming }: AskingProps) {
  const onPick = useCallback(
    (value: string) => onAnswer(question.id, value),
    [onAnswer, question.id]
  );

  const done = shown >= question.prompt.split(" ").length;

  return (
    <div className="flex gap-3">
      <Sparkles aria-hidden className="mt-1.5 size-4 shrink-0 text-smoke" />
      <div className="min-w-0 flex-1">
        <StreamedText
          className="text-[17px] leading-relaxed"
          id={question.id}
          shown={shown}
          streaming={streaming}
          text={question.prompt}
        />

        {done ? (
          <>
            {question.kind === "choice" && question.choices ? (
              <ChoiceRow choices={question.choices} onPick={onPick} />
            ) : null}
            {question.kind === "multi" && question.choices ? (
              <MultiAnswer choices={question.choices} onPick={onPick} />
            ) : null}
            {question.kind === "range" ? (
              <RangeAnswer onPick={onPick} question={question} />
            ) : null}

            <div className="mt-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-hairline" />
              <span className="text-[13px] text-smoke">or type an answer</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The answered form: one quiet row.
 *
 * This is the detail that stops a five-question interview leaving a graveyard
 * of dead widgets in the thread.
 */
function AnsweredQuestion({
  label,
  onEdit,
  questionId,
  value,
}: {
  label: string;
  onEdit: (questionId: string) => void;
  questionId: string;
  value: string;
}) {
  const handleEdit = useCallback(
    () => onEdit(questionId),
    [onEdit, questionId]
  );

  return (
    <div className="answered-row flex items-baseline gap-6 border-hairline border-b py-3">
      <Label className="w-32 shrink-0">{label}</Label>
      <span className="flex-1 font-mono text-[15px] text-bone tabular-nums">
        {value}
      </span>
      <Pill onClick={handleEdit} size="sm" variant="text">
        Edit
      </Pill>
    </div>
  );
}

export { AnsweredQuestion, AskingQuestion };
