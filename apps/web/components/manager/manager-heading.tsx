import type { ReactNode } from "react";

/**
 * Every editing surface opens the same way: what this is, how many of them
 * there are, and the controls that act on all of them.
 */
function ManagerHeading({
  children,
  count,
  title,
}: {
  /** The controls, right-aligned on the same line. */
  children?: ReactNode;
  /** Rendered in mono — it is a number. */
  count?: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6 pb-8">
      <div className="flex items-baseline gap-4">
        <h1 className="font-display font-semibold text-[32px] text-bone leading-none tracking-[-0.02em]">
          {title}
        </h1>
        {count ? (
          <span className="font-mono text-[13px] text-smoke tabular-nums">
            {count}
          </span>
        ) : null}
      </div>

      {children ? (
        <div className="flex flex-wrap items-center gap-4">{children}</div>
      ) : null}
    </div>
  );
}

export { ManagerHeading };
