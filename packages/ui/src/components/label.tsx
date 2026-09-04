import { cn } from "@workspace/ui/lib/utils";
import type { HTMLAttributes } from "react";

/**
 * Every label on the site: sans, small caps, 11px, wide-tracked, smoke.
 *
 * Never mono. Mono labels are the single thing that made an earlier version
 * of this design read as a terminal rather than a store.
 *
 * The type now comes from `.t-label` in globals.css, which is the one
 * definition of this idiom — it had drifted into four spellings across the
 * package. Colour stays here rather than in the class, since `.t-*` never
 * carries colour.
 */
const LABEL_CLASS = "t-label select-none text-smoke";

type LabelProps = HTMLAttributes<HTMLElement> & {
  /**
   * A span by default. Use "label" when the text genuinely labels a form
   * control — passing `htmlFor` implies it — and "dt" in a definition list.
   */
  as?: "span" | "label" | "dt";
  htmlFor?: string;
};

function Label({ as, className, htmlFor, ...props }: LabelProps) {
  const className_ = cn(LABEL_CLASS, className);

  if (as === "label" || htmlFor) {
    return (
      // biome-ignore lint/a11y/noLabelWithoutControl: children carry the text, and the control when one is wrapped
      <label
        className={className_}
        data-slot="label"
        htmlFor={htmlFor}
        {...props}
      />
    );
  }

  if (as === "dt") {
    return <dt className={className_} data-slot="label" {...props} />;
  }

  return <span className={className_} data-slot="label" {...props} />;
}

export { LABEL_CLASS, Label };
