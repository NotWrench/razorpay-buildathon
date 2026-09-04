"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { PillLink } from "@/components/common/pill-link";
import { useSession } from "@/lib/auth-client";
import { shellRoutes } from "@/lib/routes";

export interface HeaderAccountUser {
  email?: string | null;
  id?: string;
  image?: string | null;
  name?: string | null;
}

interface HeaderAccountProps {
  avatarClassName?: string;
  className?: string;
  initialUser?: HeaderAccountUser | null;
}

/**
 * Top-bar identity control.
 *
 * For a guest (not authenticated), renders a "Sign in" button that directs to /login
 * instead of displaying an anonymous avatar or mock profile picture.
 * For an authenticated user, renders their profile avatar (or name initial) linking
 * to their account screen.
 */
export function HeaderAccount({
  avatarClassName,
  className,
  initialUser,
}: HeaderAccountProps) {
  const { data: session } = useSession();
  const user = session?.user ?? initialUser;

  if (!user) {
    return (
      <PillLink
        className={cn("whitespace-nowrap", className)}
        href={shellRoutes.login}
        size="sm"
        variant="ghost"
      >
        Sign in
      </PillLink>
    );
  }

  const initial = (user.name?.[0] ?? user.email?.[0] ?? "U").toUpperCase();

  return (
    <Link
      aria-label={user.name ? `Account (${user.name})` : "Account"}
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity duration-micro hover:opacity-80",
        user.image ? "border border-hairline" : "bg-riser hover:bg-hairline",
        avatarClassName
      )}
      href={shellRoutes.account}
    >
      {user.image ? (
        <Image
          alt={user.name || "Account"}
          className="size-full object-cover"
          height={28}
          referrerPolicy="no-referrer"
          src={user.image}
          unoptimized
          width={28}
        />
      ) : (
        <Label className="text-2xs text-bone">{initial}</Label>
      )}
    </Link>
  );
}
