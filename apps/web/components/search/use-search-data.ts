"use client";

import { useEffect, useState } from "react";
import { searchIdle, searchQuery } from "@/lib/mock";
import type { SearchOverlayData } from "@/lib/mock/types";

/** Long enough that a fast typist makes one request, not eight. */
const FETCH_MS = 200;

/** Slow enough that a screen reader hears one result, not one per keystroke. */
const ANNOUNCE_MS = 700;

/**
 * The overlay's two clocks.
 *
 * `settledTerm` is what the results actually answer. Keeping it separate from
 * the term in the field is what lets the note line say “nothing matches x”
 * only when a response for *that* term has genuinely come back empty, rather
 * than during the gap where an older response is still on screen.
 */
function useSearchData(open: boolean, term: string) {
  const [idle, setIdle] = useState<SearchOverlayData["idle"] | null>(null);
  const [results, setResults] = useState<SearchOverlayData["typing"] | null>(
    null
  );
  const [settledTerm, setSettledTerm] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!open || idle) {
      return;
    }

    let cancelled = false;

    searchIdle().then((data) => {
      if (!cancelled) {
        setIdle(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, idle]);

  useEffect(() => {
    if (!(open && term)) {
      setResults(null);
      setSettledTerm("");

      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await searchQuery(term);

      if (!cancelled) {
        setResults(response);
        setSettledTerm(term);
      }
    }, FETCH_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, term]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = setTimeout(() => {
      if (!(term && results) || settledTerm !== term) {
        setAnnouncement("");

        return;
      }

      setAnnouncement(
        results.total === 0
          ? `No parts match ${term}`
          : `${results.total} parts match ${term}`
      );
    }, ANNOUNCE_MS);

    return () => clearTimeout(timer);
  }, [open, results, settledTerm, term]);

  return { announcement, idle, results, settledTerm };
}

export { useSearchData };
