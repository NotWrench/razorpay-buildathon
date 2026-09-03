import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

/**
 * The only button shape on the site.
 *
 * `solid` is the one place lacquer is allowed as a fill — a filled red pill
 * always means "this does something". `ghost` carries a hairline, never a red
 * one. `text` is for tertiary actions that still need to look clickable.
 */
const pillVariants = cva(
  /*
   * The focus ring lives here so every pill on the site has the same one: a
   * 1px bone outline at 3px offset, never a glow. A ring declared per-screen
   * is a ring that is missing on the screen somebody forgot.
   */
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium outline-none transition-colors duration-[180ms] focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-[3px] disabled:pointer-events-none disabled:opacity-40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "md",
      variant: "solid",
    },
    variants: {
      size: {
        md: "h-11 px-6 text-[15px]",
        sm: "h-9 px-4 text-[13px]",
      },
      variant: {
        ghost: "border border-hairline text-bone hover:border-smoke",
        solid: "bg-lacquer text-white hover:bg-ember",
        text: "px-0 text-smoke hover:text-bone",
      },
    },
  }
);

type PillProps = ComponentProps<"button"> & VariantProps<typeof pillVariants>;

function Pill({ className, size, variant, type, ...props }: PillProps) {
  return (
    <button
      className={cn(pillVariants({ className, size, variant }))}
      data-slot="pill"
      type={type ?? "button"}
      {...props}
    />
  );
}

export { Pill, pillVariants };
