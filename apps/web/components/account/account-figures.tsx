"use client";

import { Label } from "@workspace/ui/components/label";
import { CountUp } from "@workspace/ui/components/motion/count-up";
import { formatPaise } from "@workspace/ui/lib/money";
import type { AccountFigures } from "@/lib/data/types";

/**
 * Four numbers, and nothing around them.
 *
 * No tiles, no borders, no sparklines: a border around a number says the
 * number is a component, and these are just facts about a person's account.
 * The type does all the work — a label above, a large mono figure below.
 */

/** Money counts in whole rupees; paise frames read as a broken price. */
const wholeRupees = (paise: number) =>
  formatPaise(Math.round(paise / 100) * 100);

function AccountFiguresRow({ figures }: { figures: AccountFigures }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
      <div>
        <Label as="dt">Orders</Label>
        <dd className="mt-2">
          <CountUp
            className="t-num-md text-bone md:text-xl"
            value={figures.orders}
          />
        </dd>
      </div>

      <div>
        <Label as="dt">Total spent</Label>
        <dd className="mt-2">
          <CountUp
            className="t-num-md text-bone md:text-xl"
            format={wholeRupees}
            value={figures.totalSpentPaise}
          />
        </dd>
      </div>

      <div>
        <Label as="dt">Builds</Label>
        <dd className="mt-2">
          <CountUp
            className="t-num-md text-bone md:text-xl"
            value={figures.builds}
          />
        </dd>
      </div>

      <div>
        <Label as="dt">Conversations</Label>
        <dd className="mt-2">
          <CountUp
            className="t-num-md text-bone md:text-xl"
            value={figures.conversations}
          />
        </dd>
      </div>
    </dl>
  );
}

export { AccountFiguresRow };
