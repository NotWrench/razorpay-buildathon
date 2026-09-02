"use client";

import { useEffect, useRef } from "react";

/**
 * A 2px lacquer bar across the very top, scaled to how far down the page you
 * are. Off unless a page asks for it — on a short page it is noise, and it
 * spends one of the screen's five reds.
 */
function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!node) {
      return;
    }

    let frame = 0;

    const write = () => {
      frame = 0;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;

      node.style.transform = `scaleX(${Math.min(Math.max(progress, 0), 1)})`;
    };

    const onScroll = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(write);
      }
    };

    write();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-lacquer"
      ref={ref}
      style={{ transform: "scaleX(0)" }}
    />
  );
}

export { ScrollProgress };
