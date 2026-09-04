"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import type { ChangeEvent } from "react";
import { useCallback, useId, useState } from "react";

/**
 * The two ways this side of the product asks "are you sure".
 *
 * Neither one has a filled red button. A destructive action is lacquer TEXT: a
 * red rectangle is the shape of "press me", and nothing that deletes an order
 * or closes a store should be wearing it.
 */

const POPUP =
  "fixed top-1/2 left-1/2 z-71 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-panel p-7 shadow-float outline-none transition-opacity duration-standard data-ending-style:opacity-0 data-ending-style:duration-exit data-starting-style:opacity-0";

const BACKDROP =
  "fixed inset-0 z-70 bg-void/80 backdrop-blur-[4px] transition-opacity duration-exit data-ending-style:opacity-0 data-starting-style:opacity-0";

/** A plain confirmation: two words and two ways out. */
function ConfirmDialog({
  body,
  confirmLabel,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const cancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  const confirm = useCallback(() => {
    onOpenChange(false);
    onConfirm();
  }, [onConfirm, onOpenChange]);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP} />
        <Dialog.Popup className={POPUP}>
          <Dialog.Title className="t-display-sm text-bone">
            {title}
          </Dialog.Title>
          <Dialog.Description className="t-body mt-3 text-smoke leading-relaxed">
            {body}
          </Dialog.Description>

          <div className="mt-7 flex items-center justify-end gap-4">
            <Pill onClick={cancel} size="sm" variant="ghost">
              Cancel
            </Pill>
            <Pill
              className="text-lacquer hover:text-ember"
              onClick={confirm}
              size="sm"
              variant="text"
            >
              {confirmLabel}
            </Pill>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * A confirmation you have to type your way through.
 *
 * For the two things on this side that cannot be undone — a refund and closing
 * the store. Typing the word is the safeguard, which is why nothing around it
 * needs to shout.
 */
function TypedConfirmDialog({
  body,
  confirmLabel,
  onConfirm,
  onOpenChange,
  open,
  title,
  word,
}: {
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  word: string;
}) {
  const inputId = useId();
  const [typed, setTyped] = useState("");

  const armed = typed.trim() === word;

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTyped(event.target.value),
    []
  );

  const change = useCallback(
    (next: boolean) => {
      setTyped("");
      onOpenChange(next);
    },
    [onOpenChange]
  );

  const cancel = useCallback(() => change(false), [change]);

  const confirm = useCallback(() => {
    change(false);
    onConfirm();
  }, [change, onConfirm]);

  return (
    <Dialog.Root onOpenChange={change} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP} />
        <Dialog.Popup className={POPUP}>
          <Dialog.Title className="t-display-sm text-bone">
            {title}
          </Dialog.Title>
          <Dialog.Description className="t-body mt-3 text-smoke leading-relaxed">
            {body}
          </Dialog.Description>

          <div className="mt-6">
            <Label htmlFor={inputId}>Type {word} to confirm</Label>
            <input
              autoComplete="off"
              className="t-num-sm mt-2 h-[52px] w-full rounded-full border border-hairline bg-void px-5 text-bone tracking-[0.08em] outline-none transition-colors duration-micro focus:border-bone"
              id={inputId}
              onChange={onChange}
              value={typed}
            />
          </div>

          <div className="mt-7 flex items-center justify-end gap-4">
            <Pill onClick={cancel} size="sm" variant="ghost">
              Cancel
            </Pill>
            <Pill
              className="text-lacquer hover:text-ember disabled:text-smoke"
              disabled={!armed}
              onClick={confirm}
              size="sm"
              variant="text"
            >
              {confirmLabel}
            </Pill>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { ConfirmDialog, TypedConfirmDialog };
