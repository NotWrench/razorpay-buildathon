"use client";

// Imported from the modes module rather than the package root: the root pulls
// in the database client, which has no business in a browser bundle.
import { CHAT_MODES, type ChatMode } from "@workspace/ai/modes";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

/**
 * §6's task modes.
 *
 * A mode narrows which tools the agent may reach for the next turn, so
 * choosing "Compare" is a promise that nothing will be ordered. Picking the
 * active mode again clears it, which puts every tool back on the table.
 */

const LABELS: Record<ChatMode, string> = {
  about: "About",
  build: "Build",
  compare: "Compare",
  orders: "Orders",
  recommend: "Recommend",
};

export function ModeTabs({
  mode,
  onChange,
}: {
  mode: ChatMode | undefined;
  onChange: (mode: ChatMode | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-border border-b px-3 py-2">
      {CHAT_MODES.map((entry) => (
        <Button
          className={cn(mode === entry && "bg-muted text-foreground")}
          key={entry}
          onClick={() => onChange(mode === entry ? undefined : entry)}
          size="xs"
          variant="ghost"
        >
          {LABELS[entry]}
        </Button>
      ))}
    </div>
  );
}
