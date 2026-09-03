import type { ReactNode } from "react";

/**
 * The arrival half of a route transition.
 *
 * It lives in `template.tsx`, which the app router re-mounts on every
 * navigation — that remount is what replays the animation. The departure is
 * the router's own: the outgoing tree unmounts before this one mounts, so
 * there is never a moment where both exist to cross-fade.
 *
 * This one is CSS rather than a motion timeline, deliberately. It gates the
 * opacity of the entire page, so if its timeline ever stalled — a throttled
 * frame loop, a busy main thread — the whole route would sit half-transparent
 * with nothing to recover it. A keyframe animation runs off the compositor,
 * needs no JavaScript at all, and honours reduced motion in the stylesheet.
 */
function RouteFade({ children }: { children: ReactNode }) {
  return <div className="route-fade">{children}</div>;
}

export { RouteFade };
