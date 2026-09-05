"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Search, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

/**
 * The filter you type.
 *
 * A pill, like everything else you can press on this side, with the glyph
 * inside it rather than floating beside it. The clear button only exists once
 * there is something to clear.
 */
function ManagerSearch({
  className,
  label,
  onValueChange,
  placeholder,
  value,
}: {
  className?: string;
  /** What it searches, for a screen reader. */
  label: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value),
    [onValueChange]
  );

  const clear = useCallback(() => onValueChange(""), [onValueChange]);

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-full border border-hairline bg-panel pr-1.5 pl-4 transition-colors duration-micro focus-within:border-smoke",
        className
      )}
    >
      <Search aria-hidden className="size-3.5 shrink-0 text-smoke" />
      <input
        aria-label={label}
        className="t-body-sm h-full min-w-0 flex-1 bg-transparent text-bone outline-none placeholder:text-smoke"
        onChange={change}
        placeholder={placeholder}
        value={value}
      />
      {value ? (
        <button
          aria-label="Clear search"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-smoke outline-none transition-colors duration-micro hover:text-bone focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-2"
          onClick={clear}
          type="button"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export { ManagerSearch };
