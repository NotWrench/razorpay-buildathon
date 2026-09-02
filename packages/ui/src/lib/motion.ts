/**
 * The motion clock. Every timeline in the app reads its duration and its
 * curve from here, so the whole site moves at one speed.
 *
 * Exits are deliberately faster than entrances: arrival is an event, leaving
 * should get out of the way.
 */

type Bezier = [number, number, number, number];

export const DUR = {
  /** Anything leaving the screen. */
  exit: 0.28,
  /** Hover, press, focus — anything under the pointer. */
  micro: 0.18,
  /** Scroll-triggered arrivals. */
  reveal: 0.8,
  /** The default: panels, overlays, sheets. */
  standard: 0.42,
} as const;

export const EASE = {
  inOut: [0.65, 0, 0.35, 1] as Bezier,
  out: [0.22, 1, 0.36, 1] as Bezier,
  soft: [0.33, 1, 0.68, 1] as Bezier,
} as const;

/** Gap between staggered children, in seconds. */
export const STAGGER_STEP = 0.06;

/** After this many children the stagger stops growing. */
export const STAGGER_CAP = 8;
