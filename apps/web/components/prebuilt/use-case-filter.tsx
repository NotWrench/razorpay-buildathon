"use client";

import { cn } from "@workspace/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { route } from "@/lib/routes";

/**
 * Five pills, one active.
 *
 * The active one fills **bone**, not lacquer. Red on this site means "this
 * does something" — a filter that is merely on is a state, not an action, and
 * the page already spends its one red on the first row's Configure.
 */

const USE_CASES = [
  { label: "All", value: "" },
  { label: "Gaming", value: "gaming" },
  { label: "Creator", value: "creator" },
  { label: "Workstation", value: "workstation" },
  { label: "Small form factor", value: "sff" },
] as const;

function FilterPill({
  active,
  label,
  onSelect,
  value,
}: {
  active: boolean;
  label: string;
  onSelect: (value: string) => void;
  value: string;
}) {
  const handleClick = useCallback(() => onSelect(value), [onSelect, value]);

  return (
    <button
      aria-pressed={active}
      className={cn(
        "t-body h-11 rounded-full border px-6 transition-colors duration-micro",
        active
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

function UseCaseFilter({ active }: { active: string }) {
  const router = useRouter();

  const onSelect = useCallback(
    (value: string) => {
      router.replace(route(value ? `/prebuilts?use=${value}` : "/prebuilts"), {
        scroll: false,
      });
    },
    [router]
  );

  return (
    <div className="flex flex-wrap gap-3">
      {USE_CASES.map((useCase) => (
        <FilterPill
          active={active === useCase.value}
          key={useCase.value || "all"}
          label={useCase.label}
          onSelect={onSelect}
          value={useCase.value}
        />
      ))}
    </div>
  );
}

export { USE_CASES, UseCaseFilter };
