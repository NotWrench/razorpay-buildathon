"use client";

import { cn } from "@workspace/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface KenBurnsProps {
  children: ReactNode;
  className?: string;
  /** Seconds for one pass. Slow enough that you notice it only by looking. */
  duration?: number;
  /** Where the scale ends. 1.04 is the whole budget. */
  to?: number;
}

/**
 * The only loop on the site.
 *
 * Band imagery drifts 4% over twenty seconds and back — enough that a static
 * render doesn't read as a screenshot, slow enough that nothing is moving
 * while you read. Under reduced motion there is no timeline at all.
 */
function KenBurns({
  children,
  className,
  duration = 20,
  to = 1.04,
}: KenBurnsProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      animate={{ scale: to }}
      className={cn(className)}
      initial={{ scale: 1 }}
      transition={{
        duration,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse",
      }}
    >
      {children}
    </motion.div>
  );
}

export { KenBurns };
