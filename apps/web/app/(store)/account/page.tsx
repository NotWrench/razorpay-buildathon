import { Label } from "@workspace/ui/components/label";
import type { Metadata } from "next";
import { AccountFiguresRow } from "@/components/account/account-figures";
import { AddressList } from "@/components/account/address-list";
import { OrderTable } from "@/components/account/order-table";
import { SavedBuilds } from "@/components/account/saved-builds";
import { getAccount } from "@/lib/mock";

/**
 * The profile.
 *
 * Blocks 96px apart on plain ground — no card wraps anything, and the identity
 * block has no avatar frame. A person's own name does not need a container to
 * be believed.
 */

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const account = await getAccount();

  return (
    <div className="grid gap-24">
      <section>
        <h1 className="font-display font-semibold text-[28px] text-bone leading-none tracking-[-0.02em]">
          {account.name}
        </h1>
        <p className="mt-3 text-[15px] text-smoke">{account.email}</p>
        <p className="mt-1 font-mono text-[13px] text-smoke tabular-nums">
          Member since {account.memberSince}
        </p>
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
        <SavedBuilds builds={account.builds} />
      </section>

      <section id="addresses">
        <Label>Addresses</Label>
        <AddressList addresses={account.addresses} />
      </section>
    </div>
  );
}
