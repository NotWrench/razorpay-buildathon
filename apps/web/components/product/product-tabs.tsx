"use client";

import { Label } from "@workspace/ui/components/label";
import { SpecList } from "@workspace/ui/components/spec-list";
import { StatusLine } from "@workspace/ui/components/status-line";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ProductDetail } from "@/lib/data/types";

/**
 * Specifications · Compatibility · Reviews.
 *
 * The underline moves on `transform` alone — translate plus a horizontal
 * scale — rather than animating `left` and `width`. Those two are layout
 * properties: animating them makes the browser re-lay-out the row on every
 * frame, and it shows.
 */

const TABS = ["Specifications", "Compatibility", "Reviews"] as const;

type Tab = (typeof TABS)[number];

/** The width the underline is drawn at before it is scaled to fit a tab. */
const BASE_WIDTH = 100;

function TabButton({
  active,
  label,
  onSelect,
  register,
}: {
  active: boolean;
  label: Tab;
  onSelect: (tab: Tab) => void;
  register: (label: Tab, node: HTMLButtonElement | null) => void;
}) {
  const handleClick = useCallback(() => onSelect(label), [label, onSelect]);
  const handleRef = useCallback(
    (node: HTMLButtonElement | null) => register(label, node),
    [label, register]
  );

  return (
    <button
      aria-selected={active}
      className={cn(
        "t-body py-3 transition-colors duration-micro",
        active ? "text-bone" : "text-smoke hover:text-bone"
      )}
      onClick={handleClick}
      ref={handleRef}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

function ReviewBars({ distribution }: { distribution: number[] }) {
  const most = Math.max(...distribution, 1);

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = distribution[stars - 1] ?? 0;

        return (
          <div className="flex items-center gap-4" key={stars}>
            <span className="t-num-xs w-3 text-smoke">
              {stars}
            </span>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-hairline">
              <span
                className="block h-full rounded-full bg-smoke"
                style={{ width: `${(count / most) * 100}%` }}
              />
            </span>
            <span className="t-num-xs w-10 text-right text-smoke">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProductTabs({ product }: { product: ProductDetail }) {
  /*
   * Reviews was always clickable and always rendered an empty panel when the
   * product had none. A tab that leads nowhere is worse than a missing tab,
   * so the row only offers what there is something to show for.
   */
  const tabList = product.reviews
    ? TABS
    : TABS.filter((tab) => tab !== "Reviews");

  const [active, setActive] = useState<Tab>("Specifications");
  const [underline, setUnderline] = useState({ scale: 0, x: 0 });
  const tabs = useRef(new Map<Tab, HTMLButtonElement>());

  const register = useCallback((label: Tab, node: HTMLButtonElement | null) => {
    if (node) {
      tabs.current.set(label, node);
    } else {
      tabs.current.delete(label);
    }
  }, []);

  useLayoutEffect(() => {
    const node = tabs.current.get(active);
    const row = node?.parentElement;

    if (!(node && row)) {
      return;
    }

    setUnderline({
      scale: node.offsetWidth / BASE_WIDTH,
      x: node.offsetLeft - row.offsetLeft,
    });
  }, [active]);

  return (
    <div>
      <div className="relative border-hairline border-b">
        <div className="flex gap-8" role="tablist">
          {tabList.map((tab) => (
            <TabButton
              active={active === tab}
              key={tab}
              label={tab}
              onSelect={setActive}
              register={register}
            />
          ))}
        </div>
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 origin-left bg-bone transition-transform duration-standard ease-[cubic-bezier(.22,1,.36,1)]"
          style={{
            transform: `translateX(${underline.x}px) scaleX(${underline.scale})`,
            width: `${BASE_WIDTH}px`,
          }}
        />
      </div>

      <div className="pt-10">
        {active === "Specifications" ? (
          <div className="grid gap-10 md:grid-cols-2">
            {product.specGroups.map((group) => (
              <div key={group.title}>
                <Label>{group.title}</Label>
                <SpecList className="mt-4" rows={group.rows} />
              </div>
            ))}
          </div>
        ) : null}

        {active === "Compatibility" ? (
          <div className="max-w-[70ch]">
            {product.compatibility ? (
              <ul className="border-hairline border-t">
                {product.compatibility.checks.map((check) => (
                  <li
                    className="flex flex-col gap-2 border-hairline border-b py-5 sm:flex-row sm:items-baseline sm:gap-8"
                    key={check.rule}
                  >
                    <Label className="sm:w-40 sm:shrink-0">{check.label}</Label>
                    <StatusLine
                      className="flex-1"
                      message={check.message}
                      state={check.state}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-body text-smoke">
                Nothing to check until a build is open.
              </p>
            )}
          </div>
        ) : null}

        {active === "Reviews" && product.reviews ? (
          <div className="grid gap-12 md:grid-cols-[280px_1fr]">
            <div>
              <p className="t-num-lg text-2xl text-bone">
                {product.reviews.average}
              </p>
              <p className="t-num-xs mt-3 text-smoke">
                {product.reviews.total} ratings
              </p>
              <div className="mt-6">
                <ReviewBars distribution={product.reviews.distribution} />
              </div>
            </div>

            <ul className="border-hairline border-t">
              {product.reviews.items.map((review) => (
                <li className="border-hairline border-b py-5" key={review.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="t-body text-bone">{review.author}</p>
                    <p className="t-num-xs text-smoke">
                      {review.rating}/5
                    </p>
                  </div>
                  <p className="t-body mt-2 max-w-[66ch] text-smoke">
                    {review.body}
                  </p>
                  <p className="t-body-sm mt-2 text-smoke">{review.when}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { ProductTabs };
