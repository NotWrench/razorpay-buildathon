"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { lastStorePath } from "@/components/layout/route-memory";
import type { ConversationSummary } from "@/lib/data/conversations";
import { route, shellRoutes } from "@/lib/routes";

/**
 * The chat page's chrome — one thin bar, and history behind it.
 *
 * There is no permanent left sidebar, and that is the point: a rail of old
 * conversations is the first thing that makes an assistant look like a clone
 * of somebody else's product, and it spends a third of the width on something
 * you open once a week. History slides over when asked and leaves again.
 *
 * What this bar did *not* have was a way out. The wordmark was a plain
 * `<span>` rather than a link, there was no back control, no cart, no account
 * — so once a shopper landed here the browser's own back button was the only
 * exit from the page. It carries all three now, while staying deliberately
 * narrower than the store header: the conversation is the page, and a full
 * nav competing with it would say otherwise.
 */

function BackButton() {
  const router = useRouter();

  /*
   * The store shell records the last page it rendered, and this returns there.
   *
   * `router.back()` alone is wrong on a fresh tab: the entry before this one
   * belongs to whatever site the shopper was on before ours, so Back would
   * leave. `document.referrer` cannot rescue it either — it is fixed at
   * document load and never updates across client-side navigation, so a check
   * against it sends everyone to the home page regardless of where they came
   * from. The breadcrumb in `RouteMemory` is the only thing that actually
   * knows.
   */
  const goBack = useCallback(() => {
    const previous = lastStorePath();

    router.push(previous ? route(previous) : shellRoutes.home);
  }, [router]);

  return (
    <button
      aria-label="Back"
      className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-smoke transition-colors duration-micro hover:bg-riser hover:text-bone"
      onClick={goBack}
      type="button"
    >
      <ArrowLeft aria-hidden className="size-[18px]" />
    </button>
  );
}

function HistoryRow({
  active,
  conversation,
  onNavigate,
}: {
  active: boolean;
  conversation: ConversationSummary;
  onNavigate: () => void;
}) {
  return (
    <div className="relative">
      {active ? (
        <span
          aria-hidden
          className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-lacquer"
        />
      ) : null}
      <Link
        className={cn(
          "t-body block truncate py-2.5 pl-4 transition-colors duration-micro",
          active ? "text-bone" : "text-smoke hover:text-bone"
        )}
        href={shellRoutes.conversation(conversation.id)}
        onClick={onNavigate}
      >
        {conversation.title}
      </Link>
    </div>
  );
}

function HistoryGroup({
  activeId,
  conversations,
  heading,
  onNavigate,
}: {
  activeId: string | null;
  conversations: ConversationSummary[];
  heading: string;
  onNavigate: () => void;
}) {
  if (conversations.length === 0) {
    return null;
  }

  return (
    <>
      <Label className="mt-8 block first:mt-0">{heading}</Label>
      <div className="mt-3">
        {conversations.map((conversation) => (
          <HistoryRow
            active={conversation.id === activeId}
            conversation={conversation}
            key={conversation.id}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </>
  );
}

function isToday(date: Date): boolean {
  const now = new Date();

  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function ChatChrome({
  cartCount = 0,
  conversations = [],
}: {
  cartCount?: number;
  conversations?: ConversationSummary[];
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  const activeId = useSearchParams().get("c");

  const today = conversations.filter((entry) => isToday(entry.updatedAt));
  const earlier = conversations.filter((entry) => !isToday(entry.updatedAt));

  return (
    <header className="sticky top-0 z-40 h-16 border-hairline border-b bg-void/95 backdrop-blur-[16px]">
      <div className="flex h-full items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:px-8">
        <BackButton />

        <Link
          aria-label="Nexus, home"
          className="flex shrink-0 items-baseline gap-1"
          href={shellRoutes.home}
        >
          <span className="t-display-sm font-bold text-bone">NEXUS</span>
          <span aria-hidden className="size-[5px] rounded-full bg-lacquer" />
        </Link>

        <span aria-hidden className="h-5 w-px shrink-0 bg-hairline" />

        <p className="t-label truncate text-smoke">Assistant</p>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Pill onClick={openHistory} size="sm" variant="text">
            History
          </Pill>

          <Link
            aria-label={`Cart, ${cartCount} items`}
            className="relative flex size-9 items-center justify-center rounded-full text-smoke transition-colors duration-micro hover:bg-riser hover:text-bone"
            href={shellRoutes.cart}
          >
            <ShoppingBag aria-hidden className="size-[18px]" />
            {cartCount > 0 ? (
              <span className="t-num-xs absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-lacquer text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>

          <Link
            aria-label="Account"
            className="flex size-7 items-center justify-center rounded-full bg-riser transition-colors duration-micro hover:bg-hairline"
            href={shellRoutes.account}
          >
            <Label className="text-2xs text-bone">S</Label>
          </Link>
        </div>
      </div>

      <Dialog.Root onOpenChange={setHistoryOpen} open={historyOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/55 backdrop-blur-[4px] transition-opacity duration-exit data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="surface-float fixed inset-y-0 left-0 z-71 flex w-[300px] flex-col bg-carbon outline-none transition-transform duration-standard ease-[cubic-bezier(.22,1,.36,1)] data-ending-style:-translate-x-full data-starting-style:-translate-x-full data-ending-style:duration-exit data-ending-style:ease-[cubic-bezier(.65,0,.35,1)]">
            <div className="flex items-center justify-between px-6 pt-6 pb-5">
              <Dialog.Title className="t-display-sm text-bone">
                History
              </Dialog.Title>
              <Pill onClick={closeHistory} size="sm" variant="text">
                Close
              </Pill>
            </div>

            <div className="px-6">
              <Link
                className="t-body flex h-11 w-full items-center justify-center rounded-full border border-hairline text-bone transition-colors duration-micro hover:border-smoke"
                href={shellRoutes.assistant}
                onClick={closeHistory}
              >
                New chat
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8">
              {conversations.length === 0 ? (
                <p className="t-body-sm text-smoke">
                  Nothing here yet. Ask something and this is where it will be.
                </p>
              ) : (
                <>
                  <HistoryGroup
                    activeId={activeId}
                    conversations={today}
                    heading="Today"
                    onNavigate={closeHistory}
                  />
                  <HistoryGroup
                    activeId={activeId}
                    conversations={earlier}
                    heading="Earlier"
                    onNavigate={closeHistory}
                  />
                </>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

export { ChatChrome };
