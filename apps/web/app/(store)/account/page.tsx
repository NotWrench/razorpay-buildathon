import { Label } from "@workspace/ui/components/label";
import type { Metadata } from "next";
import { AccountFiguresRow } from "@/components/account/account-figures";
import { AddressList } from "@/components/account/address-list";
import { OrderTable } from "@/components/account/order-table";
import { SavedBuilds } from "@/components/account/saved-builds";
import { PillLink } from "@/components/common/pill-link";
import { getAccount, storeSlug } from "@/lib/data";
import { shellRoutes } from "@/lib/routes";

/**
 * The profile.
 *
 * Blocks 96px apart on plain ground — no card wraps anything, and the identity
 * block has no avatar frame. A person's own name does not need a container to
 * be believed.
 */

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  /* The slug the address and build actions post to — they are scoped per
     store, the same as the cart and the builder. */
  const [account, slug] = await Promise.all([getAccount(), storeSlug()]);
  const isGuest = account.email === "Guest session";

  return (
    <div className="grid gap-24">
      <section>
        <h1 className="t-display-md text-bone leading-none">{account.name}</h1>
        <p className="t-body mt-3 text-smoke">{account.email}</p>
        <p className="t-num-xs mt-1 text-smoke">
          Member since {account.memberSince}
        </p>
        {isGuest ? (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <PillLink href={shellRoutes.login} size="sm" variant="ghost">
              Sign in
            </PillLink>
            <p className="t-body-sm text-smoke">
              Sign in to keep your orders and builds across devices.
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <AccountFiguresRow figures={account.figures} />
      </section>

      <section id="orders">
        <Label>Recent orders</Label>
        <OrderTable orders={account.orders} />
      </section>

      <section id="builds">
        <Label>Saved builds</Label>
        <SavedBuilds builds={account.builds} slug={slug} />
      </section>

      <section id="addresses">
        <Label>Addresses</Label>
        <AddressList addresses={account.addresses} slug={slug} />
      </section>
    </div>
  );
}
