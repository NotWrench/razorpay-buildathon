"use client";

import type { ChatMode, PageContextInput } from "@workspace/ai";
import { Button } from "@workspace/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { SparklesIcon } from "lucide-react";
import { StorefrontAssistant } from "./storefront/storefront-assistant";

/**
 * The assistant, reachable from every storefront page.
 *
 * It travels with the page context rather than living on a page of its own,
 * which is the §7 point: asking "will this fit?" while looking at a card
 * should not require restating which card. The dock is mounted by the store
 * layout and handed the context each page computes for itself.
 */
export function AssistantDock({
  context,
  initialMode,
  slug,
  storeName,
}: {
  context?: PageContextInput;
  initialMode?: ChatMode;
  slug: string;
  storeName: string;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            className="fixed right-4 bottom-4 z-40 shadow-lg lg:right-6 lg:bottom-6"
            size="lg"
          />
        }
      >
        <SparklesIcon />
        Ask
      </SheetTrigger>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        side="right"
      >
        <SheetHeader className="border-border border-b">
          <SheetTitle>{storeName} assistant</SheetTitle>
          <SheetDescription>
            Grounded in this shop&apos;s catalog. Nothing is charged without
            your approval.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1">
          <StorefrontAssistant
            context={context}
            initialMode={initialMode}
            slug={slug}
            storeName={storeName}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
