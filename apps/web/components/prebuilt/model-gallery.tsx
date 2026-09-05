"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { useCallback, useState } from "react";
import { PhotoGround } from "@/components/common/photo-ground";

/**
 * Three shots in a row, and a lightbox.
 *
 * Base UI's Dialog is doing the unglamorous work here — focus trap, Escape,
 * backdrop click, restoring focus to the tile you opened from. Hand-rolling
 * that is how a gallery ends up trapping keyboard users inside a picture.
 */

interface ModelGalleryProps {
  name: string;
  /**
   * This machine's shots, already resolved. Client component, so the server
   * page does the filesystem lookup — see `lib/landing-images.ts`.
   */
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
      aria-label={`${name}, view ${index + 1}`}
      className="group block w-full"
      onClick={handleClick}
      type="button"
    >
      <PhotoGround
        alt=""
        category="case"
        className="aspect-[3/4]"
        imageClassName="transition-transform duration-standard group-hover:scale-[1.03]"
        sizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 90vw"
        src={view}
      />
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

  /* After the hooks, never before — an early return above them changes the
     hook order between renders. A machine with no gallery shows no gallery
     rather than a heading over an empty grid. */
  if (views.length === 0) {
    return null;
  }

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
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-71 max-h-[92dvh] w-fit max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-panel p-6 shadow-float outline-none transition-opacity duration-standard data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-exit">
            <div className="flex items-center justify-between pb-5">
              <Dialog.Title className="t-model text-base text-bone">
                {name}
              </Dialog.Title>
              <Pill onClick={close} size="sm" variant="text">
                Close
              </Pill>
            </div>
            {/*
              Sized from its height, not its width. As a flex item with a
              definite height and `width:auto`, the aspect ratio resolves the
              width — so the popup hugs a portrait picture instead of forcing it
              into a 1052px-wide box and growing to 1700px tall, which is what
              put the Close button off the top of the screen.

              This is also the one slot where the whole frame matters, and at
              2:3 it gets it: nothing is cropped here.
            */}
            <div className="flex justify-center">
              <PhotoGround
                alt={`${name}, view ${active + 1}`}
                category="case"
                className="aspect-[2/3] h-[min(72dvh,760px)]"
                sizes="(min-width: 768px) 520px, 80vw"
                src={views[active]}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

export { ModelGallery };
