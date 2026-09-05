"use client";

import { Label } from "@workspace/ui/components/label";
import { SpecList } from "@workspace/ui/components/spec-list";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { PrebuiltDetail } from "@/lib/data/types";

/**
 * The exhaustive table, closed by default, at the very bottom — marketing
 * first, specifications last.
 *
 * The open/close animates `grid-template-rows` from `0fr` to `1fr` rather than
 * a measured height. It is worth being straight about the trade-off: the rule
 * is "never animate height", and grid rows are still a layout property. The
 * transform-only alternatives are worse — scaling a panel double-scales the
 * type inside it, and claiming the space instantly makes the footer jump under
 * the reader's cursor. This is the version that behaves correctly at the cost
 * of one layout property, and it needs no measurement to work.
 */
function FullSpecs({ machine }: { machine: PrebuiltDetail }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const toggle = useCallback(() => setOpen((current) => !current), []);

  return (
    <section className="mx-auto w-full max-w-[1280px] px-8 lg:px-16" id="specs">
      <div>
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-6 py-7 text-left"
          onClick={toggle}
          type="button"
        >
          <Label>Full specifications</Label>
          <ChevronDown
            aria-hidden
            className="size-4 text-smoke transition-transform duration-exit"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          />
        </button>

        <div
          className="grid transition-[grid-template-rows] duration-standard ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
          id={panelId}
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="grid gap-10 pb-10 md:grid-cols-2">
              {machine.specGroups.map((group) => (
                <div key={group.title}>
                  <Label>{group.title}</Label>
                  <SpecList className="mt-4" rows={group.rows} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { FullSpecs };
