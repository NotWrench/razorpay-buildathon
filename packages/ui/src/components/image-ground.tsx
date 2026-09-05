import { cn } from "@workspace/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

interface ImageGroundProps {
  children: ReactNode;
  className?: string;
  /** For placement a class cannot express — a fanned stack, say. */
  style?: CSSProperties;
}

/**
 * Where every product render lives.
 *
 * The ground is always lighter than the card it sits inside — riser inside
 * panel inside void gives three separations without drawing a single border.
 * That gradient is the depth mechanism for the whole site.
 *
 * It reads off `--riser` rather than the two hexes that used to be written in
 * here, so the one mechanism the design rests on is finally the token it was
 * always described as. The top edge is lifted a little above riser and the
 * bottom settles below it, which is what gives a flat render somewhere to sit.
 *
 * The gradient is for a line drawing, which is a diagram and wants air around
 * it. A photograph never sees it: `PhotoGround` fills this box edge to edge, so
 * the ground is covered. That is deliberate — floating a photograph on the
 * gradient put two different darks together with a hard rectangle between them,
 * and no amount of matching the colour underneath ever quite hid the join.
 *
 * `relative` and `overflow-hidden` are what let a filling photograph take this
 * box's shape and its corner radius.
 */
function ImageGround({ children, className, style }: ImageGroundProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-[16px]",
        "ground-surface",
        className
      )}
      data-slot="image-ground"
      style={style}
    >
      {children}
    </div>
  );
}

export { ImageGround };
