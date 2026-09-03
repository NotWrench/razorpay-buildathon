import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

/**
 * Four segments, and an honest count.
 *
 * The score is what it measures — length, then case, then a digit, then a
 * symbol — so the fourth segment means something specific rather than being
 * the meter's way of saying "good enough". A meter that fills on eight
 * characters of `password` teaches people that eight characters is fine.
 */

const SEGMENTS = 4;

const WORDS = ["Too short", "Weak", "Fair", "Strong"] as const;

const LOWER = /[a-z]/;
const UPPER = /[A-Z]/;
const DIGIT = /\d/;
const SYMBOL = /[^\w\s]/;

function scorePassword(value: string): number {
  if (value.length < 8) {
    return 0;
  }

  let score = 1;

  if (LOWER.test(value) && UPPER.test(value)) {
    score += 1;
  }

  if (DIGIT.test(value)) {
    score += 1;
  }

  if (SYMBOL.test(value)) {
    score += 1;
  }

  return score;
}

function StrengthMeter({ value }: { value: string }) {
  const score = scorePassword(value);

  return (
    <div className="mt-3">
      <div className="flex gap-1.5">
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            className={cn(
              "h-[3px] flex-1 rounded-full transition-colors duration-[180ms]",
              index < score ? "bg-lacquer" : "bg-hairline"
            )}
            // biome-ignore lint/suspicious/noArrayIndexKey: the segments are positions, not data
            key={index}
          />
        ))}
      </div>

      {value.length > 0 ? (
        <Label className="mt-2 block">{WORDS[Math.max(score - 1, 0)]}</Label>
      ) : null}
    </div>
  );
}

export { StrengthMeter, scorePassword };
