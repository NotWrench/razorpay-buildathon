/**
 * The overnight run, on a clock.
 *
 * `runMerchantBriefing` was written to run while nobody is watching and its
 * only caller was a button — a merchant clicking "run the overnight briefing"
 * at eleven in the morning. "Overnight" described the prompt, not when it
 * happened, and a campaign orchestrator that only orchestrates when watched is
 * an assistant.
 *
 *   bun run nightly              # every store
 *   bun run nightly -- --slug nova-electronics
 *
 * Point cron, Task Scheduler or a systemd timer at it. For a Vercel
 * deployment, `vercel.json` schedules `/api/cron/briefing`, which does the same
 * thing over HTTP.
 *
 * **It cannot change anything that matters, and that is structural.** Every
 * money tool returns `user-approval` from the same policy the interactive
 * agent uses, and there is no human here to give it — so those tools suspend
 * and never execute. What the run leaves behind is a `pending_approval`
 * campaign that discounts nothing and a `draft` reorder that buys nothing. The
 * merchant wakes up to proposals, not to a shop somebody rearranged.
 *
 * It runs as the store's own owner rather than as a service identity, so the
 * audit trail names a person and `scheduled: true` separates "while I was
 * asleep" from "because I asked".
 */

import {
  buildMerchantContext,
  hasModelCredentials,
  runMerchantBriefing,
} from "@workspace/ai";
import { db, merchants } from "@workspace/db";
import { eq } from "drizzle-orm";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);

  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  if (!hasModelCredentials()) {
    console.error(
      "No model provider key is set, so there is nothing to run. See AI_PROVIDER in .env."
    );
    process.exit(1);
  }

  const slug = argValue("--slug");

  const stores = slug
    ? await db.select().from(merchants).where(eq(merchants.storeSlug, slug))
    : await db.select().from(merchants);

  if (stores.length === 0) {
    console.error(slug ? `No store with slug ${slug}` : "No stores to brief");
    process.exit(1);
  }

  console.log(`Briefing ${stores.length} store(s).\n`);

  let failed = 0;

  /*
   * Sequential on purpose. Each briefing is a multi-step model run, and a
   * provider that rate-limits by the minute answers a parallel fan-out with
   * 429s — so the fast version briefs no one.
   */
  for (const store of stores) {
    console.log(`── ${store.businessName} (${store.storeSlug})`);

    try {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose, see above
      const ctx = await buildMerchantContext({
        actor: {
          identifier: store.userId,
          type: "human",
          userId: store.userId,
        },
        merchantId: store.id,
      });

      const result = await runMerchantBriefing(ctx);

      console.log(result.text.trim());
      console.log(
        `\n   drafted ${result.draftedCampaigns} campaign(s), raised ${result.raisedReorders} reorder(s)`
      );

      /*
       * Worth printing rather than swallowing. A suspended tool is the safety
       * property working, and seeing which ones stopped is how you confirm the
       * unattended run really could not spend anything.
       */
      if (result.blockedTools.length > 0) {
        console.log(
          `   suspended for a human: ${result.blockedTools.join(", ")}`
        );
      }
    } catch (error) {
      /*
       * One store's bad run must not stop the others. A model timeout on the
       * third shop is not a reason the fourth goes un-briefed, and a scheduler
       * that gives up halfway leaves a silence nobody notices until morning.
       */
      failed += 1;
      console.error(`   failed: ${(error as Error).message}`);
    }

    console.log("");
  }

  if (failed > 0) {
    console.error(`${failed} of ${stores.length} store(s) failed.`);
    process.exit(1);
  }

  process.exit(0);
}

await main();
