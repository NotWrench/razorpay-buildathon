import Link from "next/link";
import { managerRoutes } from "@/lib/routes";

/**
 * The nudge to connect a payment account, on the page the operator lands on.
 *
 * It is a line and a link, not a banner with an icon and a dismiss button: the
 * store is taking payments perfectly well through the platform's keys, so this
 * is an unfinished setup step rather than an outage, and it should read like
 * one. It disappears the moment the store has keys of its own.
 */
export function ConnectRazorpayNotice() {
  return (
    <p className="mt-8 rounded-[20px] border border-hairline bg-carbon px-6 py-5 text-[15px] text-smoke leading-relaxed">
      Orders are settled through the platform&rsquo;s Razorpay account.{" "}
      <Link
        className="text-bone underline underline-offset-4"
        href={managerRoutes.account}
      >
        Connect this store&rsquo;s own account
      </Link>{" "}
      to be paid directly.
    </p>
  );
}
