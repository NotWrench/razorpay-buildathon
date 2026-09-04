import type { CompatibilityStatus } from "@workspace/commerce/compatibility";
import { Badge } from "@workspace/ui/components/badge";

/**
 * The engine's verdict, in one word.
 *
 * Colour never carries it alone — the word is the message and the tone only
 * agrees with it, which is the same rule the v3 `StatusLine` follows.
 */

const WORD: Record<CompatibilityStatus, string> = {
  compatible: "Compatible",
  incompatible: "Incompatible",
  insufficient_data: "Not enough data",
  requires_verification: "Needs a look",
};

const TONE: Record<
  CompatibilityStatus,
  "default" | "destructive" | "secondary"
> = {
  compatible: "default",
  incompatible: "destructive",
  insufficient_data: "secondary",
  requires_verification: "secondary",
};

export function CompatibilityStatusBadge({
  status,
}: {
  status: CompatibilityStatus;
}) {
  return (
    <Badge className="uppercase" variant={TONE[status]}>
      {WORD[status]}
    </Badge>
  );
}
