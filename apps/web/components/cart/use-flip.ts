"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * FLIP: First, Last, Invert, Play.
 *
 * When a row leaves, the rows below it have to close the gap. The obvious way
 * is to animate the container's height, which is a layout property and janks
 * on every frame. Instead we measure where each row was, let the browser lay
 * the list out without the removed row, then invert the difference as a
 * `translateY` and release it. Nothing but `transform` ever animates, and the
 * browser lays out once rather than sixty times.
 */

/** How long a leaving row takes to fade before the list closes over it. */
const EXIT_MS = 280;

const SETTLE_MS = 420;
const EASE = "cubic-bezier(.22,1,.36,1)";

interface Flip {
  /** Call immediately before the state change that removes or reorders rows. */
  capture: () => void;
  /** Attach to every row so it can be measured. */
  register: (key: string, node: HTMLElement | null) => void;
}

function useFlip(dependency: unknown): Flip {
  const nodes = useRef(new Map<string, HTMLElement>());
  const positions = useRef(new Map<string, number>());
  const armed = useRef(false);

  const register = useCallback((key: string, node: HTMLElement | null) => {
    if (node) {
      nodes.current.set(key, node);
    } else {
      nodes.current.delete(key);
    }
  }, []);

  const capture = useCallback(() => {
    positions.current.clear();

    for (const [key, node] of nodes.current) {
      positions.current.set(key, node.getBoundingClientRect().top);
    }

    armed.current = true;
  }, []);

  /*
   * The dependency is the point of this effect, not an accident: the FLIP has
   * to run in the layout pass that follows the list changing, and the list is
   * the only thing that says when that happened.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the list change is the trigger
  useLayoutEffect(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: refs change between renders
    if (!armed.current) {
      return;
    }

    armed.current = false;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      positions.current.clear();

      return;
    }

    for (const [key, node] of nodes.current) {
      const before = positions.current.get(key);

      if (before === undefined) {
        continue;
      }

      const delta = before - node.getBoundingClientRect().top;

      if (delta === 0) {
        continue;
      }

      node.style.transition = "none";
      node.style.transform = `translateY(${delta}px)`;

      requestAnimationFrame(() => {
        node.style.transition = `transform ${SETTLE_MS}ms ${EASE}`;
        node.style.transform = "";
      });
    }

    positions.current.clear();
  }, [dependency]);

  return { capture, register };
}

export { EXIT_MS, useFlip };
