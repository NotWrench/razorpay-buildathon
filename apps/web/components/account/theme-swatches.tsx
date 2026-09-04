"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import { useCallback } from "react";

/**
 * Three themes, shown rather than named.
 *
 * Each swatch is the theme in miniature — its ground, its surface, its accent
 * — because "Black + Purple" tells you less in a sentence than three
 * rectangles do at a glance. Selection is a bone border and a check, not a
 * fill: filling the selected one would put a coloured block on a page whose
 * palette is the thing being chosen.
 */

export interface ThemeOption {
  accent: string;
  ground: string;
  id: string;
  /** What reads on this theme's ground — the check has to survive a light one. */
  ink: string;
  name: string;
  surface: string;
}

export const THEMES: ThemeOption[] = [
  {
    accent: "#c8102e",
    ground: "#060606",
    id: "black-red",
    ink: "#f2f0ed",
    name: "Black + Red",
    surface: "#1f1f1f",
  },
  {
    accent: "#7c5cff",
    ground: "#060606",
    id: "black-purple",
    ink: "#f2f0ed",
    name: "Black + Purple",
    surface: "#1f1f1f",
  },
  {
    accent: "#6d4bd8",
    ground: "#f4f2ef",
    id: "white-purple",
    ink: "#141414",
    name: "White + Purple",
    surface: "#e2ded8",
  },
];

interface ThemeSwatchesProps {
  onChange: (id: string) => void;
  value: string;
}

function ThemeSwatch({
  onChange,
  option,
  selected,
}: {
  onChange: (id: string) => void;
  option: ThemeOption;
  selected: boolean;
}) {
  const choose = useCallback(() => onChange(option.id), [onChange, option.id]);

  return (
    <button
      aria-pressed={selected}
      className="group text-left outline-none"
      onClick={choose}
      type="button"
    >
      <span
        className={cn(
          "relative flex h-[72px] w-full items-end gap-1.5 overflow-hidden rounded-[12px] border p-2.5 transition-colors duration-micro",
          selected
            ? "border-bone"
            : "border-hairline group-hover:border-smoke group-focus-visible:border-bone"
        )}
        style={{ backgroundColor: option.ground }}
      >
        <span
          className="h-6 flex-1 rounded-[4px]"
          style={{ backgroundColor: option.surface }}
        />
        <span
          className="h-6 w-4 rounded-[4px]"
          style={{ backgroundColor: option.accent }}
        />
        {selected ? (
          <Check
            aria-hidden
            className="check-in absolute top-2.5 right-2.5 size-3.5"
            strokeWidth={2.5}
            style={{ color: option.ink }}
          />
        ) : null}
      </span>

      <span
        className={cn(
          "t-body-sm mt-2 block transition-colors duration-micro",
          selected ? "text-bone" : "text-smoke group-hover:text-bone"
        )}
      >
        {option.name}
      </span>
    </button>
  );
}

function ThemeSwatches({ onChange, value }: ThemeSwatchesProps) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-4">
      {THEMES.map((option) => (
        <ThemeSwatch
          key={option.id}
          onChange={onChange}
          option={option}
          selected={option.id === value}
        />
      ))}
    </div>
  );
}

export { ThemeSwatches };
