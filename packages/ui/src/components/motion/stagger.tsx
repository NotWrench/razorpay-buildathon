"use client";

import { Reveal } from "@workspace/ui/components/motion/reveal";
import { STAGGER_CAP, STAGGER_STEP } from "@workspace/ui/lib/motion";
import { Children, type ReactNode } from "react";

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** Seconds before the first child starts. */
  delay?: number;
  /** Class applied to each child's wrapper — grid items need it. */
  itemClassName?: string;
}

/**
 * Reveals its children in sequence, 60ms apart.
 *
 * The delay stops growing after the eighth child: a twenty-item grid should
 * not take a second and a quarter to finish arriving.
 */
function Stagger({
  children,
  className,
  delay = 0,
  itemClassName,
}: StaggerProps) {
  return (
    <div className={className}>
      {Children.map(children, (child, index) => (
        <Reveal
          className={itemClassName}
          delay={delay + Math.min(index, STAGGER_CAP - 1) * STAGGER_STEP}
        >
          {child}
        </Reveal>
      ))}
    </div>
  );
}

export { Stagger };
