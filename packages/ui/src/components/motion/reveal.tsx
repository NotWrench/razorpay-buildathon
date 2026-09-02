"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to hold before starting. Used by <Stagger>. */
  delay?: number;
  /** Travel distance in px. */
  distance?: number;
}

/** Layout effects don't run on the server, and the warning about it is noise. */
const useArmingEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Scroll-triggered arrival: fade up, once, never again.
 *
 * The settled state is the default and hiding is opt-in. The component arms
 * itself in a layout effect — before the browser paints, and only once it
 * knows it can observe and animate. That ordering is the whole point: a
 * reveal that starts hidden and waits for JavaScript turns every band on the
 * page into a blank rectangle if the script never arrives or the frame loop
 * stalls. The failure mode here is "no animation", never "no content".
 *
 * The animation is a CSS transition for the same reason — it runs off the
 * compositor and cannot be starved.
 */
function Reveal({
  children,
  className,
  delay = 0,
  distance = 16,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useArmingEffect(() => {
    const node = ref.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!node) {
      return;
    }

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    node.dataset.armed = "true";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.dataset.revealed = "true";
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn("reveal", className)}
      ref={ref}
      style={
        {
          "--reveal-delay": `${Math.round(delay * 1000)}ms`,
          "--reveal-distance": `${distance}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export { Reveal };
