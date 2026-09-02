"use client";

import { EASE } from "@workspace/ui/lib/motion";
import { cn } from "@workspace/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";

interface ShimmerProps {
  className?: string;
  /** Rounding of the block. Cards are 20px, image grounds 16px. */
  radius?: "ground" | "pill" | "card";
}

const RADIUS = {
  card: "rounded-[20px]",
  ground: "rounded-[16px]",
  pill: "rounded-full",
} as const;

/**
 * The only skeleton on the site: a panel block with one slow bone sweep at 4%
 * crossing it. No pulse, no grey-on-grey blink.
 *
 * Under reduced motion it is simply a panel block — the loading state still
 * reads, it just doesn't move.
 */
function Shimmer({ className, radius = "card" }: ShimmerProps) {
  const reduced = useReducedMotion();

  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden bg-panel",
        RADIUS[radius],
        className
      )}
    >
      {reduced ? null : (
        <motion.div
          animate={{ x: "200%" }}
          className="absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent via-bone/[0.04] to-transparent"
          initial={{ x: "0%" }}
          transition={{
            duration: 1.8,
            ease: EASE.soft,
            repeat: Number.POSITIVE_INFINITY,
            repeatDelay: 0.4,
          }}
        />
      )}
    </div>
  );
}

export { Shimmer };
