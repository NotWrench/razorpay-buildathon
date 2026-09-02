"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartRow } from "@/components/cart/cart-row";
import { CartSummary } from "@/components/cart/cart-summary";
import { EXIT_MS, useFlip } from "@/components/cart/use-flip";
import { PillLink } from "@/components/common/pill-link";
import { AssistantDock } from "@/components/dock/assistant-dock";
import type { Cart, CartLine } from "@/lib/mock/types";
import { shellRoutes } from "@/lib/routes";

/**
 * The cart.
 *
 * Everything here is local state over the mock. The shapes are chosen to match
 * `lib/actions/cart.ts`, which identifies a line by `productId` plus an
 * optional `buildId` — so wiring the real actions later is replacing the
 * bodies of `onRemove` and `onQuantity`, not rewriting the screen.
 */

/** How long the undo toast stays up. */
const UNDO_MS = 5000;

const keyFor = (line: CartLine) =>
  `${line.buildId ?? "loose"}:${line.product.id}`;

interface Removed {
  at: number;
  index: number;
  line: CartLine;
}

function CartScreen({ cart }: { cart: Cart }) {
  const [lines, setLines] = useState(cart.lines);
  const [exiting, setExiting] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { capture, register } = useFlip(lines);

  useEffect(
    () => () => {
      // biome-ignore lint/suspicious/noUnnecessaryConditions: the ref is set by the time this unmounts
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const onQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) =>
      current.map((line) =>
        keyFor(line) === key ? { ...line, quantity } : line
      )
    );
  }, []);

  /**
   * The row fades where it stands, then the list closes over it with a FLIP.
   * Doing both at once reads as the row being yanked out from under the
   * cursor.
   */
  const onRemove = useCallback(
    (key: string) => {
      setExiting(key);

      timer.current = setTimeout(() => {
        capture();
        setLines((current) => {
          const index = current.findIndex((entry) => keyFor(entry) === key);
          const gone = current[index];

          if (gone) {
            setRemoved({ at: Date.now(), index, line: gone });
          }

          return current.filter((entry) => keyFor(entry) !== key);
        });
        setExiting(null);
      }, EXIT_MS);
    },
    [capture]
  );

  const onUndo = useCallback(() => {
    if (!removed) {
      return;
    }

    capture();
    setLines((current) => {
      const next = [...current];

      next.splice(removed.index, 0, removed.line);

      return next;
    });
    setRemoved(null);
  }, [capture, removed]);

  /* The toast is live for five seconds, then the removal is just a removal. */
  useEffect(() => {
    if (!removed) {
      return;
    }

    const dismiss = setTimeout(() => setRemoved(null), UNDO_MS);

    return () => clearTimeout(dismiss);
  }, [removed]);

  const totals = useMemo(() => {
    const subtotalPaise = lines.reduce(
      (total, line) => total + line.product.pricePaise * line.quantity,
      0
    );
    const discountPaise = subtotalPaise > 0 ? cart.discountPaise : 0;
    const taxPaise = Math.round((subtotalPaise - discountPaise) * 0.18);

    return {
      discountPaise,
      shippingPaise: cart.shippingPaise,
      subtotalPaise,
      taxPaise,
      totalPaise: subtotalPaise - discountPaise + cart.shippingPaise + taxPaise,
    };
  }, [cart.discountPaise, cart.shippingPaise, lines]);

  const groups = useMemo(
    () =>
      cart.builds
        .map((build) => ({
          build,
          lines: lines.filter((line) => line.buildId === build.id),
        }))
        .filter((group) => group.lines.length > 0),
    [cart.builds, lines]
  );

  const loose = lines.filter((line) => !line.buildId);

  /**
   * The note only speaks when it has something true to say, and it never
   * proposes a purchase. An upsell dressed as advice is the fastest way to
   * make an assistant untrustworthy.
   */
  const note = useMemo(() => {
    for (const group of groups) {
      const present = new Set(group.lines.map((line) => line.product.category));
      const missing = group.build.requiredSlots.filter(
        (slot) => !present.has(slot as never)
      );

      if (missing.length > 0) {
        return `${group.build.name} still needs a ${missing.join(", a ")}.`;
      }
    }

    if (lines.some((line) => line.issue)) {
      return "One line needs a look before this can ship.";
    }

    return "Everything in your build fits. Nothing to flag.";
  }, [groups, lines]);

  if (lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-5 py-32 sm:px-8 lg:px-10 2xl:px-16">
        <p className="text-[21px] text-bone">Your cart is empty.</p>
        <div className="mt-8 flex flex-wrap gap-6">
          <PillLink href={shellRoutes.components} variant="text">
            Browse parts →
          </PillLink>
          <PillLink href={shellRoutes.prebuilts} variant="text">
            See the machines →
          </PillLink>
          <PillLink href={shellRoutes.assistant} variant="text">
            Ask the assistant to build one →
          </PillLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pt-14 sm:px-8 lg:px-10 2xl:px-16">
      <h1 className="font-display font-semibold text-[40px] text-bone leading-none tracking-[-0.03em]">
        Cart
      </h1>

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_380px]">
        <div>
          {groups.map((group) => {
            const present = new Set(
              group.lines.map((line) => line.product.category)
            );
            const missing = group.build.requiredSlots.filter(
              (slot) => !present.has(slot as never)
            );
            const subtotal = group.lines.reduce(
              (total, line) => total + line.product.pricePaise * line.quantity,
              0
            );

            return (
              <section className="mb-12" key={group.build.id}>
                <div className="flex items-baseline justify-between gap-6 border-hairline border-b pb-3">
                  <Label className="text-bone">{group.build.name}</Label>
                  <span className="font-mono text-[13px] text-smoke tabular-nums">
                    {formatPaise(subtotal)}
                  </span>
                </div>

                {missing.length > 0 ? (
                  <StatusLine
                    className="mt-4"
                    message={`This build has no ${missing.join(" and no ")} in it.`}
                    state="needs_verification"
                  />
                ) : null}

                <ul className="mt-2">
                  {group.lines.map((line) => (
                    <CartRow
                      exiting={exiting === keyFor(line)}
                      key={keyFor(line)}
                      line={line}
                      onQuantity={onQuantity}
                      onRemove={onRemove}
                      register={register}
                      rowKey={keyFor(line)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {loose.length > 0 ? (
            <section>
              <div className="border-hairline border-b pb-3">
                <Label>Also in your cart</Label>
              </div>
              <ul className="mt-2">
                {loose.map((line) => (
                  <CartRow
                    exiting={exiting === keyFor(line)}
                    key={keyFor(line)}
                    line={line}
                    onQuantity={onQuantity}
                    onRemove={onRemove}
                    register={register}
                    rowKey={keyFor(line)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div>
          <CartSummary {...totals} />

          <p className="mt-10 flex items-start gap-2 border-hairline border-t pt-8 text-[13px] text-smoke">
            <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {note}
          </p>
        </div>
      </div>

      {/* Docked on small screens: the total and the way out stay reachable
          without scrolling back past the list. */}
      <div className="sticky bottom-0 z-50 -mx-8 mt-12 flex items-center justify-between gap-5 border-hairline border-t bg-void px-8 py-4 lg:hidden">
        <div>
          <Label>Total</Label>
          <p className="mt-1 font-mono text-[21px] text-bone tabular-nums">
            {formatPaise(totals.totalPaise)}
          </p>
        </div>
        <PillLink href={shellRoutes.checkout}>Checkout</PillLink>
      </div>

      <AssistantDock context={{ page: "cart" }} contextLabel="your cart" />

      {removed ? (
        <div
          aria-live="polite"
          className="fixed bottom-8 left-1/2 z-60 flex -translate-x-1/2 items-center gap-5 rounded-full bg-panel py-3 pr-3 pl-6 shadow-float"
        >
          <span className="text-[13px] text-smoke">
            Removed {removed.line.product.name}.
          </span>
          <Pill onClick={onUndo} size="sm" variant="ghost">
            Undo
          </Pill>
        </div>
      ) : null}
    </div>
  );
}

export { CartScreen };
