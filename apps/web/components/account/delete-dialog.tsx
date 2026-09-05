"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import type { ChangeEvent } from "react";
import { useCallback, useId, useState } from "react";

/**
 * Deleting the account, behind a word you have to type.
 *
 * No bordered danger zone: a red rectangle around a control is decoration that
 * claims to be a safeguard. Typing the word is the safeguard, and everything
 * else on the row can then be as quiet as the rest of the page.
 *
 * Base UI's Dialog does the focus trap, Escape and focus restoration.
 */

const CONFIRM_WORD = "DELETE";

function DeleteDialog({ onConfirm }: { onConfirm: () => void }) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const armed = typed.trim() === CONFIRM_WORD;

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTyped(event.target.value),
    []
  );

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    setTyped("");
  }, []);

  const confirm = useCallback(() => {
    setOpen(false);
    setTyped("");
    onConfirm();
  }, [onConfirm]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Trigger
        className="t-body text-ember transition-colors duration-micro hover:text-bone"
        render={<button type="button" />}
      >
        Delete account
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/80 backdrop-blur-[4px] transition-opacity duration-exit data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-71 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-panel p-7 shadow-float outline-none transition-opacity duration-standard data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-exit">
          <Dialog.Title className="t-display-sm text-bone">
            Delete this account
          </Dialog.Title>

          <Dialog.Description className="t-body mt-3 text-smoke leading-relaxed">
            Twelve orders, five saved builds and every conversation go with it.
            This cannot be undone.
          </Dialog.Description>

          <div className="mt-6">
            <Label htmlFor={inputId}>Type {CONFIRM_WORD} to confirm</Label>
            <input
              autoComplete="off"
              className="t-num-sm mt-2 h-[52px] w-full rounded-full border border-hairline bg-void px-5 text-bone tracking-[0.08em] outline-none transition-colors duration-micro focus:border-bone"
              id={inputId}
              onChange={onChange}
              value={typed}
            />
          </div>

          <div className="mt-7 flex items-center justify-end gap-5">
            <Pill onClick={close} size="sm" variant="text">
              Keep it
            </Pill>
            <Pill
              className="text-ember hover:text-bone disabled:text-smoke"
              disabled={!armed}
              onClick={confirm}
              size="sm"
              variant="text"
            >
              Delete account
            </Pill>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { DeleteDialog };
