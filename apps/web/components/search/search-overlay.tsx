"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { useRouter } from "next/navigation";
import type { ChangeEvent, CSSProperties, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Row } from "@/components/search/rows";
import { useSearch } from "@/components/search/search-context";
import {
  AssistantRow,
  ProductTile,
  TextRow,
} from "@/components/search/search-rows";
import { useSearchData } from "@/components/search/use-search-data";
import { shellRoutes } from "@/lib/routes";

/**
 * The whole screen, over the site's chrome, carrying its own.
 *
 * Three things make this feel solid rather than clever. The panel never
 * unmounts, so the mask always has something to open. Both panes of each
 * column are mounted in the same grid cell, so the column is always as tall as
 * the taller one and nothing moves when they trade places. And focus lands
 * only once the mask has finished — moving it earlier puts the caret somewhere
 * that is not on screen yet.
 */

/** How long the mask takes. Focus may not move before it finishes. */
const MASK_MS = 420;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function riseDelay(ms: number) {
  return { "--rise-delay": `${ms}ms` } as CSSProperties;
}

function SearchOverlay() {
  const { close, open } = useSearch();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState("");
  /* -1 means nobody has walked the list yet, so no row is highlighted. */
  const [active, setActive] = useState(-1);

  const trimmed = term.trim();
  const typing = trimmed.length > 0;
  const { announcement, idle, results, settledTerm } = useSearchData(
    open,
    trimmed
  );

  /* A query left standing is a search nobody asked for twice. */
  useEffect(() => {
    if (!open) {
      setTerm("");
      setActive(-1);
    }
  }, [open]);

  /* Focus lands only once the mask has finished opening. */
  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = setTimeout(
      () => inputRef.current?.focus(),
      prefersReducedMotion() ? 0 : MASK_MS
    );

    return () => clearTimeout(timer);
  }, [open]);

  const categories = useMemo(() => idle?.categories.slice(0, 6) ?? [], [idle]);
  const latest = useMemo(() => idle?.latest.slice(0, 4) ?? [], [idle]);
  const suggestions = useMemo(
    () => results?.suggestions.slice(0, 5) ?? [],
    [results]
  );
  const products = useMemo(
    () => results?.products.slice(0, 4) ?? [],
    [results]
  );
  const settled = settledTerm === trimmed && results !== null;

  const rows = useMemo<Row[]>(
    () => [
      ...(typing
        ? suggestions.map<Row>((suggestion) => ({
            key: `suggestion-${suggestion}`,
            kind: "suggestion",
            value: suggestion,
          }))
        : categories.map<Row>((category) => ({
            href: shellRoutes.shopCategory(category.slug),
            key: `category-${category.slug}`,
            kind: "category",
          }))),
      ...(typing ? products : latest).map<Row>((product) => ({
        href: shellRoutes.product(product.id),
        key: `product-${product.id}`,
        kind: "product",
      })),
      {
        href: typing
          ? shellRoutes.assistantWith(trimmed)
          : shellRoutes.assistant,
        key: "assistant",
        kind: "assistant",
      },
    ],
    [categories, latest, products, suggestions, trimmed, typing]
  );

  const activate = useCallback(
    (row: Row) => {
      if (row.kind === "suggestion" && row.value) {
        setTerm(row.value);
        inputRef.current?.focus();

        return;
      }

      if (row.href) {
        router.push(row.href);
        close();
      }
    },
    [close, router]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();

        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();

        setActive((current) => {
          if (current === -1) {
            return event.key === "ArrowDown" ? 0 : rows.length - 1;
          }

          const step = event.key === "ArrowDown" ? 1 : -1;

          return (current + step + rows.length) % rows.length;
        });

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const row = rows[active];

        if (row) {
          activate(row);

          return;
        }

        /* Enter with nothing walked to is the plain search it looks like. */
        if (trimmed) {
          router.push(shellRoutes.search(trimmed));
          close();
        }
      }
    },
    [activate, active, close, router, rows, trimmed]
  );

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setTerm(event.target.value);
    setActive(-1);
  }, []);

  const onClear = useCallback(() => {
    setTerm("");
    inputRef.current?.focus();
  }, []);

  const onSeeAll = useCallback(() => {
    router.push(shellRoutes.search(trimmed));
    close();
  }, [close, router, trimmed]);

  const activeKey = rows[active]?.key;

  return (
    <>
      <button
        aria-label="Close search"
        className="search-scrim fixed inset-0 z-80 cursor-default bg-void/55 backdrop-blur-[4px]"
        data-open={open}
        onClick={close}
        style={{ pointerEvents: open ? "auto" : "none" }}
        tabIndex={-1}
        type="button"
      />

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: a dialog owns its own key handling */}
      <div
        aria-label="Search"
        aria-modal={open}
        className="search-panel centre-mask fixed inset-0 z-81"
        data-open={open}
        inert={!open}
        onKeyDown={onKeyDown}
        role="dialog"
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        <div className="centre-mask-inner flex h-full flex-col overflow-y-auto px-8 py-8 lg:px-16">
          <div className="flex items-center justify-between">
            <span className="flex items-baseline gap-1">
              <span className="t-display-sm font-bold text-bone">ALFRED</span>
              <span
                aria-hidden
                className="size-[5px] rounded-full bg-lacquer"
              />
            </span>
            <Pill onClick={close} size="sm" variant="text">
              Close
            </Pill>
          </div>

          <div className="mx-auto mt-16 w-full max-w-[1280px]">
            <div className="relative flex items-end gap-6">
              <label className="sr-only" htmlFor="search-field">
                Search Alfred
              </label>
              <input
                autoComplete="off"
                className="search-field t-display-lg w-full bg-transparent pb-5 text-[clamp(30px,4.8vw,54px)] text-bone outline-none placeholder:text-smoke"
                id="search-field"
                onChange={onChange}
                placeholder="Search Alfred"
                ref={inputRef}
                type="search"
                value={term}
              />
              {typing ? (
                <Pill
                  className="mb-6 shrink-0"
                  onClick={onClear}
                  size="sm"
                  variant="text"
                >
                  Clear
                </Pill>
              ) : null}
              <span
                aria-hidden
                className="search-rule absolute inset-x-0 bottom-0 h-px bg-hairline"
              />
            </div>

            {/* Reserved: the note holds its height whether or not it speaks. */}
            <p className="t-body-sm mt-4 h-5 text-smoke">
              {settled && results?.total === 0
                ? `Nothing matches “${settledTerm}”.`
                : null}
            </p>

            <div className="mt-12 grid gap-16 lg:grid-cols-[300px_1fr]">
              <div className="search-rise grid" style={riseDelay(180)}>
                <div className="search-pane" data-shown={!typing}>
                  {categories.length > 0 ? (
                    <>
                      <Label>Start here</Label>
                      <ul className="mt-4">
                        {categories.map((category) => (
                          <TextRow
                            active={activeKey === `category-${category.slug}`}
                            count={category.count}
                            key={category.slug}
                            label={category.label}
                            onActivate={activate}
                            row={{
                              href: shellRoutes.shopCategory(category.slug),
                              key: `category-${category.slug}`,
                              kind: "category",
                            }}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>

                <div className="search-pane" data-shown={typing}>
                  {suggestions.length > 0 ? (
                    <>
                      <Label>Suggestions</Label>
                      <ul className="mt-4">
                        {suggestions.map((suggestion) => (
                          <TextRow
                            active={activeKey === `suggestion-${suggestion}`}
                            key={suggestion}
                            label={suggestion}
                            onActivate={activate}
                            row={{
                              key: `suggestion-${suggestion}`,
                              kind: "suggestion",
                              value: suggestion,
                            }}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="search-rise grid" style={riseDelay(240)}>
                <div className="search-pane" data-shown={!typing}>
                  {latest.length > 0 ? (
                    <>
                      <Label>The latest</Label>
                      <ul className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-4">
                        {latest.map((product) => (
                          <ProductTile
                            active={activeKey === `product-${product.id}`}
                            key={product.id}
                            onActivate={activate}
                            product={product}
                            row={{
                              href: shellRoutes.product(product.id),
                              key: `product-${product.id}`,
                              kind: "product",
                            }}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>

                <div className="search-pane" data-shown={typing}>
                  {products.length > 0 ? (
                    <>
                      <div className="flex items-baseline justify-between">
                        <Label>Parts</Label>
                        {settled && results && !results.capped ? (
                          <span className="t-num-xs text-smoke">
                            {results.total}
                          </span>
                        ) : null}
                      </div>
                      <ul className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-4">
                        {products.map((product) => (
                          <ProductTile
                            active={activeKey === `product-${product.id}`}
                            key={product.id}
                            onActivate={activate}
                            product={product}
                            row={{
                              href: shellRoutes.product(product.id),
                              key: `product-${product.id}`,
                              kind: "product",
                            }}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Reserved: "see all" arrives without moving anything. */}
            <div className="mt-8 h-6">
              {settled && results && results.total > products.length ? (
                <Pill onClick={onSeeAll} size="sm" variant="text">
                  See all {results.total} →
                </Pill>
              ) : null}
            </div>

            <div className="mt-12 border-hairline border-t pt-10 pb-6">
              <AssistantRow
                active={activeKey === "assistant"}
                onActivate={activate}
                row={{
                  href: typing
                    ? shellRoutes.assistantWith(trimmed)
                    : shellRoutes.assistant,
                  key: "assistant",
                  kind: "assistant",
                }}
                term={trimmed}
              />
            </div>
          </div>

          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>
      </div>
    </>
  );
}

export { SearchOverlay };
