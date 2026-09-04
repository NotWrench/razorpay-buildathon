"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { useCallback, useState } from "react";
import { ProductRender } from "@/components/common/product-render";

/**
 * Six shots in a 3×2 grid, and a lightbox.
 *
 * Base UI's Dialog is doing the unglamorous work here — focus trap, Escape,
 * backdrop click, restoring focus to the tile you opened from. Hand-rolling
 * that is how a gallery ends up trapping keyboard users inside a picture.
 */

interface ModelGalleryProps {
  name: string;
  /** Placeholder view identifiers until photography exists. */
  views: string[];
}

function GalleryTile({
  index,
  name,
  onOpen,
  view,
}: {
  index: number;
  name: string;
  onOpen: (index: number) => void;
  view: string;
}) {
  const handleClick = useCallback(() => onOpen(index), [index, onOpen]);

  return (
    <button
      aria-label={`${name}, ${view}`}
      className="group block w-full"
      onClick={handleClick}
      type="button"
    >
      <ImageGround className="aspect-[4/3] p-8">
        <ProductRender
          alt=""
          category="case"
          className="transition-transform duration-standard group-hover:scale-[1.03]"
        />
      </ImageGround>
    </button>
  );
}

function ModelGallery({ name, views }: ModelGalleryProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const onOpen = useCallback((index: number) => {
    setActive(index);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <section className="mx-auto w-full max-w-[1280px] px-8 lg:px-16">
      <Label>Gallery</Label>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {views.map((view, index) => (
          <GalleryTile
            index={index}
            key={view}
            name={name}
            onOpen={onOpen}
            view={view}
          />
        ))}
      </div>

      <Dialog.Root onOpenChange={setOpen} open={open}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/80 backdrop-blur-[4px] transition-opacity duration-exit data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-71 w-[min(1100px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-panel p-6 shadow-float outline-none transition-opacity duration-standard data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-exit">
            <div className="flex items-center justify-between pb-5">
              <Dialog.Title className="t-model text-base text-bone">
                {name}
              </Dialog.Title>
              <Pill onClick={close} size="sm" variant="text">
                Close
              </Pill>
            </div>
            <ImageGround className="aspect-[16/9] p-16">
              <ProductRender
                alt={`${name}, ${views[active] ?? "view"}`}
                category="case"
              />
            </ImageGround>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

export { ModelGallery };
