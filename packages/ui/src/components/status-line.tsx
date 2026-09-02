import { cn } from "@workspace/ui/lib/utils";
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

type CompatibilityState =
  | "compatible"
  | "needs_verification"
  | "incompatible"
  | "insufficient_data";

interface StatusLineProps {
  className?: string;
  /**
   * A node, not a string: the part a check names is usually worth linking to,
   * and that link belongs inside the sentence rather than beside it.
   */
  message: ReactNode;
  state: CompatibilityState;
}

/**
 * Status is always text and icon on a transparent ground — never a fill.
 *
 * That is the whole grammar: a filled lacquer pill is an action, lacquer text
 * on transparent is a problem. Colour never carries the meaning alone.
 */
const STATUS = {
  compatible: { Icon: CircleCheck, tone: "text-verdant" },
  incompatible: { Icon: CircleAlert, tone: "text-lacquer" },
  insufficient_data: { Icon: CircleHelp, tone: "text-smoke" },
  needs_verification: { Icon: TriangleAlert, tone: "text-amber" },
} as const;

function StatusLine({ className, message, state }: StatusLineProps) {
  const { Icon, tone } = STATUS[state];

  return (
    <p className={cn("flex items-start gap-2 text-[13px]", tone, className)}>
      <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export type { CompatibilityState };
export { StatusLine };
