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
        className="text-[15px] text-lacquer transition-colors duration-[180ms] hover:text-ember"
        render={<button type="button" />}
      >
        Delete account
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/80 backdrop-blur-[4px] transition-opacity duration-[280ms] data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-71 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-panel p-7 shadow-float outline-none transition-opacity duration-[420ms] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[280ms]">
          <Dialog.Title className="font-display font-semibold text-[21px] text-bone tracking-[-0.02em]">
            Delete this account
          </Dialog.Title>

          <Dialog.Description className="mt-3 text-[15px] text-smoke leading-relaxed">
            Twelve orders, five saved builds and every conversation go with it.
            This cannot be undone.
          </Dialog.Description>

          <div className="mt-6">
            <Label htmlFor={inputId}>Type {CONFIRM_WORD} to confirm</Label>
            <input
              autoComplete="off"
              className="mt-2 h-[52px] w-full rounded-full border border-hairline bg-void px-5 font-mono text-[15px] text-bone tracking-[0.08em] outline-none transition-colors duration-[180ms] focus:border-bone"
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
              className="text-lacquer hover:text-ember disabled:text-smoke"
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
