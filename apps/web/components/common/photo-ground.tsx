import type { CategorySlug } from "@workspace/db/taxonomy";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";
import type { ReactNode } from "react";
import { ProductRender } from "@/components/common/product-render";

/**
 * The site's own photography, filling its frame.
 *
 * There are two kinds of image in this build and they want opposite treatment,
 * which is why this component exists next to `ProductRender` rather than as a
 * flag on it.
 *
 * A **catalogue** photograph is a product cut out on white, arriving from
 * `image_url`. It has to sit *inside* its box with air around it, because
 * cropping one to fill the box crops through the product. That is
 * `ProductRender`, unchanged.
 *
 * A photograph **we commissioned** was shot on a studio backdrop to fill a
 * frame. Floating one inside a padded box reads as a picture pasted onto a
 * panel — you see the rectangle. Two attempts were made to hide that seam: a
 * flat background colour sampled from the photograph's edges, and a blurred
 * copy of the photograph behind itself. The first cannot match a *lit* backdrop
 * at every edge at once; the second was visible as a coloured halo. Both are
 * gone. The picture fills the box, so there is no seam to hide.
 *
 * Filling means cropping, and the defence against cropping something that
 * matters is geometry, not code: each caller's box is shaped to the ratio of
 * the photograph that goes in it. Eighteen of the fifty-one land in boxes they
 * already match exactly and lose nothing at all. The ratios are recorded in
 * `docs/IMAGE-PROMPTS.md`; if you change one, change the box.
 */

interface PhotoGroundProps {
  alt: string;
  /** What the line drawing draws while the photograph does not exist. */
  category: CategorySlug;
  /** Painted above the photograph — a scrim, a label. */
  children?: ReactNode;
  /**
   * The box: aspect ratio, height, rounding. Never padding — a photograph
   * fills this box, and padding would put a border of ground around it, which
   * is the thing this component exists to remove.
   */
  className?: string;
  /**
   * Applied only when the line drawing stands in. That *is* a diagram and does
   * want air around it, so this is where its padding lives.
   */
  fallbackClassName?: string;
  /** Applied to the image itself — a hover transform, an opacity. */
  imageClassName?: string;
  /**
   * Required, not defaulted. `fill` images give the browser no intrinsic size
   * to reason about, and these boxes range from a 183px tile to a full-bleed
   * hero; a shared default would be wrong at both ends.
   */
  sizes: string;
  /** The photograph, or undefined to draw the line render instead. */
  src?: string;
}

function PhotoGround({
  alt,
  category,
  children,
  className,
  fallbackClassName,
  imageClassName,
  sizes,
  src,
}: PhotoGroundProps) {
  return (
    <ImageGround className={cn(className, src ? undefined : fallbackClassName)}>
      {src ? (
        /*
         * No wrapper. `fill` already emits `position:absolute; inset:0`, and
         * `ImageGround` is `relative overflow-hidden` with a radius, so the
         * photograph takes the box's shape and its corners directly.
         */
        <Image
          alt={alt}
          className={cn("object-cover", imageClassName)}
          fill
          sizes={sizes}
          src={src}
        />
      ) : (
        <ProductRender alt={alt} category={category} />
      )}
      {children}
    </ImageGround>
  );
}

export { PhotoGround };
