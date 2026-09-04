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
 */
function ImageGround({ children, className, style }: ImageGroundProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-[16px]",
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
