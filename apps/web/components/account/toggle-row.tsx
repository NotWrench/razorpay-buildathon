"use client";

import { Switch } from "@base-ui/react/switch";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useId } from "react";

/**
 * A setting, and its switch.
 *
 * The track fills BONE when it is on, never red. Red on this site means "this
 * does something" — a notification preference that is merely *true* is a
 * state, and a column of red switches would shout at somebody reading their
 * own settings.
 */

interface ToggleRowProps {
  checked: boolean;
  description?: string;
  label: string;
  name: string;
  onChange: (name: string, checked: boolean) => void;
}

function ToggleRow({
  checked,
  description,
  label,
  name,
  onChange,
}: ToggleRowProps) {
  const id = useId();

  const handle = useCallback(
    (next: boolean) => onChange(name, next),
    [name, onChange]
  );

  return (
    <div className="flex items-start justify-between gap-8 py-3.5">
      <div className="min-w-0">
        <label className="t-body text-bone" htmlFor={id}>
          {label}
        </label>
        {description ? (
          <p className="t-body-sm mt-1 text-smoke">{description}</p>
        ) : null}
      </div>

      <Switch.Root
        checked={checked}
        className={cn(
          "h-6 w-11 shrink-0 rounded-full border p-[3px] transition-colors duration-micro",
          "outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-[3px]",
          checked ? "border-bone bg-bone" : "border-hairline bg-panel"
        )}
        id={id}
        onCheckedChange={handle}
      >
        <Switch.Thumb
          className={cn(
            "block size-[18px] rounded-full transition-transform duration-micro",
            checked ? "translate-x-5 bg-void" : "translate-x-0 bg-smoke"
          )}
        />
      </Switch.Root>
    </div>
  );
}

export { ToggleRow };
