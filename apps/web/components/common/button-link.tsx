import { Button } from "@workspace/ui/components/button";
import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * A link that looks like a button.
 *
 * Base UI's `Button` assumes it renders a native `<button>` and warns when the
 * `render` prop hands it something else — an `<a>` has different form and
 * accessibility semantics, so the assumption has to be turned off explicitly.
 * Doing that here rather than at each call site means the next
 * button-shaped link cannot forget it.
 *
 * Anything that navigates should be a link: middle-click, open-in-new-tab and
 * "copy link address" all come free, and none of them work on a button with an
 * onClick that pushes a route.
 */
export function ButtonLink({
  children,
  href,
  ...props
}: Omit<ComponentProps<typeof Button>, "nativeButton" | "render"> & {
  href: Route;
}) {
  return (
    <Button {...props} nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  );
}
