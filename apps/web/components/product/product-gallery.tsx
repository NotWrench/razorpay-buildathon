"use client";

import type { CategorySlug } from "@workspace/db/taxonomy";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useState } from "react";
import { ProductRender } from "@/components/common/product-render";

/**
 * The gallery. Sticky, because the right column is long and the thing you are
 * buying should not scroll away from the specification you are reading.
 *
 * Switching views crossfades: both frames stay mounted and trade opacity, so
 * the image never passes through blank on the way. A slide would move
 * something the reader is looking at.
 */

interface ProductGalleryProps {
  alt: string;
  category: CategorySlug;
  /**
   * One entry per view — a photograph's URL, or a placeholder key for a
   * product that has none. The line render stands in for the second kind.
   */
  views: string[];
}

/** A view is a photograph when it is a URL and a placeholder key otherwise. */
const isPhoto = (view: string) => view.startsWith("http");

function Thumbnail({
  active,
  alt,
  category,
  index,
  onSelect,
  view,
}: {
  active: boolean;
  alt: string;
  category: CategorySlug;
  index: number;
  onSelect: (index: number) => void;
  view: string;
}) {
  const handleClick = useCallback(() => onSelect(index), [index, onSelect]);

  return (
    <button
      aria-current={active}
      aria-label={`${alt}, view ${index + 1}`}
      className={cn(
        "size-[72px] overflow-hidden rounded-[16px] border transition-colors duration-[180ms]",
        active ? "border-bone" : "border-transparent hover:border-hairline"
      )}
      onClick={handleClick}
      type="button"
    >
      <ImageGround className="h-full w-full rounded-[15px] p-3">
        <ProductRender
          alt=""
          category={category}
          sizes="72px"
          src={isPhoto(view) ? view : undefined}
        />
      </ImageGround>
    </button>
  );
}

function ProductGallery({ alt, category, views }: ProductGalleryProps) {
  const [active, setActive] = useState(0);

  return (
    <div className="lg:sticky lg:top-[120px]">
      <ImageGround className="relative aspect-[4/3] rounded-[20px] p-16">
        {views.map((view, index) => (
          <div
            className="absolute inset-0 flex items-center justify-center p-16 transition-opacity duration-[180ms]"
            key={view}
            style={{ opacity: index === active ? 1 : 0 }}
          >
            <ProductRender
              alt={index === active ? alt : ""}
              category={category}
              sizes="(min-width: 1024px) 640px, 90vw"
              src={isPhoto(view) ? view : undefined}
            />
          </div>
        ))}
      </ImageGround>

      {views.length > 1 ? (
        <div className="mt-5 flex gap-4">
          {views.map((view, index) => (
            <Thumbnail
              active={index === active}
              alt={alt}
              category={category}
              index={index}
              key={view}
              onSelect={setActive}
              view={view}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { ProductGallery };
