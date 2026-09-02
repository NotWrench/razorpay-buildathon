"use client";

import { DUR, EASE } from "@workspace/ui/lib/motion";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface MaskOpenProps {
  children: ReactNode;
  className?: string;
  /** Drives the timeline. False plays the (faster) close. */
  open?: boolean;
}

/**
 * The centre-opening mask — the search overlay's signature, borrowed here as
 * a primitive. The panel unzips from its own middle while the content inside
 * settles the last 1.5% of its scale.
 */
function MaskOpen({ children, className, open = true }: MaskOpenProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      animate={{
        clipPath: open ? "inset(0% 0 0% 0)" : "inset(50% 0 50% 0)",
      }}
      className={className}
      initial={{ clipPath: "inset(50% 0 50% 0)" }}
      transition={{
        duration: open ? DUR.standard : DUR.exit,
        ease: EASE.out,
      }}
    >
      <motion.div
        animate={{ scale: open ? 1 : 0.985 }}
        initial={{ scale: 0.985 }}
        transition={{
          duration: open ? DUR.standard : DUR.exit,
          ease: EASE.out,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export { MaskOpen };
