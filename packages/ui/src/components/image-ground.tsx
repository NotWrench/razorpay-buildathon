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
 */
function ImageGround({ children, className, style }: ImageGroundProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-[16px]",
        "bg-[linear-gradient(155deg,#262626_0%,#151515_100%)]",
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
