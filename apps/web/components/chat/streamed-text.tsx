"use client";

import { cn } from "@workspace/ui/lib/utils";

/**
 * Text that arrives a word at a time.
 *
 * Shared by the dock and the full assistant, because there is one way this
 * site streams and it should not drift between two surfaces. Per character is
 * a typewriter; per word reads as thinking. The caret breathes over 900ms
 * rather than blinking, and under reduced motion the words are simply there.
 */
function StreamedText({
  className,
  id,
  shown,
  streaming,
  text,
}: {
  className?: string;
  /** Unique per turn, so keys stay stable when two turns share wording. */
  id: string;
  shown: number;
  streaming: boolean;
  text: string;
}) {
  const words = text.split(" ");
  const revealed = words.slice(0, shown);
  const done = shown >= words.length;

  return (
    <p className={cn("text-bone", className)}>
      {revealed.map((word, index) => (
        <span
          className="stream-word"
          // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity — the same word recurs in one sentence
          key={`${id}-${index}-${word}`}
        >
          {word}{" "}
        </span>
      ))}
      {streaming && !done ? (
        <span aria-hidden className="stream-caret text-smoke">
          ▍
        </span>
      ) : null}
    </p>
  );
}

export { StreamedText };
