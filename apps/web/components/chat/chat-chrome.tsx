"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useState } from "react";

/**
 * The chat page's chrome — one thin bar, and history behind it.
 *
 * There is no permanent left sidebar, and that is the point: a rail of old
 * conversations is the first thing that makes an assistant look like a clone
 * of somebody else's product, and it spends a third of the width on something
 * you open once a week. History slides over when asked and leaves again.
 */

interface Conversation {
  id: string;
  title: string;
  when: "today" | "earlier";
}

const CONVERSATIONS: Conversation[] = [
  { id: "c1", title: "₹80,000 1440p build", when: "today" },
  { id: "c2", title: "5070 vs 9070 XT", when: "today" },
  { id: "c3", title: "Quiet workstation, 64GB", when: "earlier" },
  { id: "c4", title: "Upgrade an old 3060 rig", when: "earlier" },
];

function HistoryRow({ active, title }: { active: boolean; title: string }) {
  return (
    <div className="relative py-2.5 pl-4">
      {active ? (
        <span
          aria-hidden
          className="absolute top-3 left-0 h-4 w-0.5 rounded-full bg-bone"
        />
      ) : null}
      <button
        className={cn(
          "text-left text-[15px] transition-colors duration-[180ms]",
          active ? "text-bone" : "text-smoke hover:text-bone"
        )}
        type="button"
      >
        {title}
      </button>
    </div>
  );
}

function ChatChrome() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  return (
    <header className="sticky top-0 z-40 h-16 border-hairline border-b bg-void">
      <div className="flex h-full items-center gap-6 px-6 lg:px-8">
        <span className="flex items-baseline gap-1">
          <span className="font-bold font-display text-[21px] text-bone tracking-[-0.02em]">
            NEXUS
          </span>
          <span aria-hidden className="size-[5px] rounded-full bg-lacquer" />
        </span>

        <Pill onClick={openHistory} size="sm" variant="text">
          History
        </Pill>

        <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-riser">
          <Label className="text-[10px] text-bone">S</Label>
        </span>
      </div>

      <Dialog.Root onOpenChange={setHistoryOpen} open={historyOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/55 backdrop-blur-[4px] transition-opacity duration-[280ms] data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed inset-y-0 left-0 z-71 flex w-[300px] flex-col bg-carbon shadow-float outline-none transition-transform duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] data-ending-style:-translate-x-full data-starting-style:-translate-x-full data-ending-style:duration-[280ms] data-ending-style:ease-[cubic-bezier(.65,0,.35,1)]">
            <div className="flex items-center justify-between px-6 pt-6 pb-5">
              <Dialog.Title className="font-display font-semibold text-[17px] text-bone">
                History
              </Dialog.Title>
              <Pill onClick={closeHistory} size="sm" variant="text">
                Close
              </Pill>
            </div>

            <div className="px-6">
              <Pill className="w-full justify-center" size="sm">
                New chat
              </Pill>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8">
              <Label>Today</Label>
              <div className="mt-3">
                {CONVERSATIONS.filter((entry) => entry.when === "today").map(
                  (entry, index) => (
                    <HistoryRow
                      active={index === 0}
                      key={entry.id}
                      title={entry.title}
                    />
                  )
                )}
              </div>

              <Label className="mt-8 block">Earlier</Label>
              <div className="mt-3">
                {CONVERSATIONS.filter((entry) => entry.when === "earlier").map(
                  (entry) => (
                    <HistoryRow
                      active={false}
                      key={entry.id}
                      title={entry.title}
                    />
                  )
                )}
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

export { ChatChrome };
