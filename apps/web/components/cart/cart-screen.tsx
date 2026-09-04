"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { CartRow } from "@/components/cart/cart-row";
import { CartSummary } from "@/components/cart/cart-summary";
import { EXIT_MS, useFlip } from "@/components/cart/use-flip";
import { PillLink } from "@/components/common/pill-link";
import { AssistantDock } from "@/components/dock/assistant-dock";
import { setCartQuantityAction } from "@/lib/actions/storefront";
import type { Cart, CartLine } from "@/lib/data/types";
import { shellRoutes } from "@/lib/routes";

/**
 * The cart.
 *
 * The rows are held in local state so a removal can animate and be undone
 * without a round trip, and every change is also sent to
 * `setCartQuantityAction`, which is the row of record. The two are reconciled
 * by `router.refresh()` — the server's answer wins, so a line the store
 * cannot actually supply snaps back rather than staying wrong until the next
 * navigation.
 *
 * Totals come from the server and are recomputed here the same way the money
 * path prices them: `subtotal − discount`, with no tax or shipping line. See
 * `lib/data/cart.ts`.
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
  const serverLines = useRef(cart.lines);

  /* A refresh brings a new server answer; adopt it, because it knows about
     stock and this component does not. */
  if (serverLines.current !== cart.lines) {
    serverLines.current = cart.lines;
    setLines(cart.lines);
  }

  const [exiting, setExiting] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

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

  /**
   * Writes one line's quantity through, then re-reads.
   *
   * The optimistic update lands first so the stepper does not lag the press;
   * the refresh is what makes the number true, because the server clamps to
   * what is on the shelf and this component has no business guessing at that.
   */
  const persist = useCallback(
    (line: CartLine, quantity: number) => {
      startTransition(async () => {
        const result = await setCartQuantityAction({
          buildId: line.buildId,
          productId: line.product.id,
          quantity,
        });

        if (!result.ok) {
          toast.error(result.message);
        }

        router.refresh();
      });
    },
    [router]
  );

  const onQuantity = useCallback(
    (key: string, quantity: number) => {
      setLines((current) => {
        const line = current.find((entry) => keyFor(entry) === key);

        if (line) {
          persist(line, quantity);
        }

        return current.map((entry) =>
          keyFor(entry) === key ? { ...entry, quantity } : entry
        );
      });
    },
    [persist]
  );

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
            persist(gone, 0);
          }

          return current.filter((entry) => keyFor(entry) !== key);
        });
        setExiting(null);
      }, EXIT_MS);
    },
    [capture, persist]
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
    persist(removed.line, removed.line.quantity);
    setRemoved(null);
  }, [capture, persist, removed]);

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
    const discountPaise = Math.min(
      subtotalPaise > 0 ? cart.discountPaise : 0,
      subtotalPaise
    );

    return {
      discountPaise,
      shippingPaise: cart.shippingPaise,
      subtotalPaise,
      taxPaise: cart.taxPaise,
      totalPaise: subtotalPaise - discountPaise + cart.shippingPaise,
    };
  }, [cart.discountPaise, cart.shippingPaise, cart.taxPaise, lines]);

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
        <p className="t-display-sm text-bone">Your cart is empty.</p>
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
      <h1 className="t-display-lg text-bone leading-none">
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
                  <span className="t-num-xs text-smoke">
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

          <p className="t-body-sm mt-10 flex items-start gap-2 border-hairline border-t pt-8 text-smoke">
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
          <p className="t-num-md mt-1 text-bone">
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
          <span className="t-body-sm text-smoke">
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
