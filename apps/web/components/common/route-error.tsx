"use client";

import { Pill } from "@workspace/ui/components/pill";

/**
 * The one error state on the site.
 *
 * One line and one way out. `reset()` re-runs the server render rather than
 * reloading the document, so a transient failure costs a click and nothing
 * else — and there is no illustration, because a picture of a broken robot
 * does not tell an operator whether to try again.
 */
function RouteError({ line, reset }: { line: string; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-32 text-center sm:px-8 lg:px-10 2xl:px-16">
      <p className="t-body-lg text-bone">{line}</p>
      <Pill className="mt-6" onClick={reset} variant="ghost">
        Try again
      </Pill>
    </div>
  );
}

export { RouteError };
