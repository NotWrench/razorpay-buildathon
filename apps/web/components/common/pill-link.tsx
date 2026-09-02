import { pillVariants } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * A link wearing the pill.
 *
 * Anything that navigates is a link, not a button with an onClick: middle
 * click, open-in-new-tab and copy-link-address all come free and none of them
 * work on a button. `Pill` stays a real `<button>` for real actions.
 */
type PillLinkProps = Omit<ComponentProps<typeof Link>, "href"> &
  VariantProps<typeof pillVariants> & {
    children: ReactNode;
    href: Route;
  };

function PillLink({
  children,
  className,
  href,
  size,
  variant,
  ...props
}: PillLinkProps) {
  return (
    <Link
      className={cn(pillVariants({ size, variant }), className)}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}

export { PillLink };
