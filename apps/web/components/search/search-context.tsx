"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface SearchContextValue {
  close: () => void;
  open: boolean;
  openSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * One piece of state, shared by the header trigger and the overlay.
 *
 * The shortcuts live here rather than in the overlay so they keep working
 * whatever the overlay is doing, and so "/" can bow out the moment the caret
 * is in a field — a shortcut that eats a keystroke someone meant to type is
 * worse than no shortcut.
 */
function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSearch = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      const shortcut =
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey);

      if (shortcut) {
        event.preventDefault();
        setOpen((current) => !current);

        return;
      }

      if (
        event.key === "/" &&
        !(event.metaKey || event.ctrlKey || event.altKey) &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* The page behind must not scroll under the overlay. */
  useEffect(() => {
    if (!open) {
      return;
    }

    const root = document.documentElement;
    const previous = root.style.overflow;

    root.style.overflow = "hidden";

    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  const value = useMemo(
    () => ({ close, open, openSearch }),
    [close, open, openSearch]
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

function useSearch() {
  const value = useContext(SearchContext);

  if (!value) {
    throw new Error("useSearch must be used inside <SearchProvider>");
  }

  return value;
}

export { SearchProvider, useSearch };
