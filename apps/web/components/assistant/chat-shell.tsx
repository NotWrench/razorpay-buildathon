"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

/**
 * The frame every assistant shares: a scrolling thread with a composer pinned
 * under it.
 *
 * Kept separate from the threads themselves because the storefront agent and
 * the merchant agent differ only in what they render inside — sharing the
 * scroll behaviour means the "stick to the bottom while streaming" rule is
 * written once.
 */

export function ChatShell({
  children,
  className,
  composer,
  header,
  streaming,
}: {
  children: ReactNode;
  className?: string;
  composer: ReactNode;
  header?: ReactNode;
  streaming: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  /*
   * `children` is the dependency that matters: the thread re-renders as parts
   * stream in, and each of those renders should keep the newest message in
   * view. `streaming` is here so the transition into and out of a turn scrolls
   * too, even when the rendered output has not changed yet.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: both are render signals, not values read in the effect.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [children, streaming]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {header}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {children}
        <div ref={endRef} />
      </div>

      {composer}
    </div>
  );
}
