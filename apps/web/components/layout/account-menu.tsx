"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { UserIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/common/button-link";
import { signOut } from "@/lib/auth-client";

/**
 * Who is signed in, and the way out.
 *
 * A guest sees a sign-in link rather than nothing: the cart works signed out,
 * but orders are far easier to find again with an account attached.
 */
export function AccountMenu({
  email,
  links,
}: {
  email: string | null;
  links: { href: Route; label: string }[];
}) {
  const router = useRouter();

  if (!email) {
    return (
      <ButtonLink href="/login" size="sm" variant="outline">
        Sign in
      </ButtonLink>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        render={<Button size="icon-sm" variant="ghost" />}
      >
        <UserIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-muted-foreground text-xs">{email}</div>
        <DropdownMenuSeparator />
        {links.map((link) => (
          <DropdownMenuItem
            key={link.href}
            nativeButton={false}
            render={<Link href={link.href} />}
          >
            {link.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            router.refresh();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
