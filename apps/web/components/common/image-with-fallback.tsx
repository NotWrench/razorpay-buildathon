"use client";

import type { ImageProps } from "next/image";
import Image from "next/image";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

/**
 * A photograph that knows how to not exist.
 *
 * The catalogue hotlinks its images to the retail listings the photos came
 * from, which means a URL that worked when the row was seeded is a URL that
 * can 404 next week — and roughly a fifth of them already do. Without this the
 * page keeps the `<img>`, the box collapses to its alt text, and the product
 * has no picture at all rather than the line drawing it was always able to
 * fall back to.
 *
 * `fallback` is a node, not a flag, so it is rendered on the server and
 * handed down: the category artwork stays out of the client bundle and only
 * the two lines of state that swap to it are shipped. That matters because
 * this sits in every product row on the site.
 *
 * `key` is deliberately tied to `src` by the callers that reuse a slot for a
 * different product — a failure must not outlive the URL that caused it.
 */
function ImageWithFallback({
  fallback,
  onFailed,
  src,
  ...props
}: Omit<ImageProps, "src" | "onError"> & {
  /** Drawn instead of the photograph once the photograph has failed. */
  fallback: ReactNode;
  /** For a parent that has to change its own box when the photo goes. */
  onFailed?: () => void;
  src: string;
}) {
  const [failed, setFailed] = useState(false);

  const fail = useCallback(() => {
    setFailed(true);
    onFailed?.();
  }, [onFailed]);

  if (failed) {
    return fallback;
  }

  return <Image {...props} onError={fail} src={src} />;
}

export { ImageWithFallback };
