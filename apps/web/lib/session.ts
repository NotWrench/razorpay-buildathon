import { auth } from "@workspace/auth";
import { db, merchants } from "@workspace/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

/** The signed-in user, for server components. */
export async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });

  return session?.user ?? null;
}

export type CurrentUser = Awaited<ReturnType<typeof currentUser>>;

/**
 * The store the signed-in user owns.
 *
 * One merchant per user for now — the dashboard is single-store, so resolving
 * it here keeps every page from repeating the lookup and the null check.
 */
export async function currentMerchant() {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.userId, user.id),
  });

  return merchant ?? null;
}
