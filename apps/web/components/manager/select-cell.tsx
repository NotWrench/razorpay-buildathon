"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import { useCallback } from "react";

/**
 * The manager side's checkbox.
 *
 * A real `<input type="checkbox">` kept off-screen with a label drawn over it,
 * so it is reachable with Tab and toggles with Space like every other checkbox
 * a keyboard user has met. Restock selects rows with it and the catalogue
 * selects cards; there is one of these, not two.
 */
function SelectCell({
  checked,
  id,
  label,
  onToggle,
}: {
  checked: boolean;
  /** Unique within the page — it becomes the input's id. */
  id: string;
  label: string;
  onToggle: (id: string) => void;
}) {
  const change = useCallback(() => onToggle(id), [id, onToggle]);
  const inputId = `select-${id}`;

  return (
    <>
      <input
        checked={checked}
        className="peer sr-only"
        id={inputId}
        onChange={change}
        type="checkbox"
      />
      <label
        className={cn(
          "flex size-5 cursor-pointer items-center justify-center rounded-[6px] border transition-colors duration-micro",
          checked
            ? "border-bone bg-bone"
            : "border-hairline hover:border-smoke",
          "peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-bone peer-focus-visible:outline-offset-[3px]"
        )}
        htmlFor={inputId}
      >
        <span className="sr-only">{label}</span>
        {checked ? (
          <Check
            aria-hidden
            className="check-in size-3.5 text-void"
            strokeWidth={2.5}
          />
        ) : null}
      </label>
    </>
  );
}

export { SelectCell };
