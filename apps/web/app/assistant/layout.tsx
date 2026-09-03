import type { ReactNode } from "react";
import { ChatChrome } from "@/components/chat/chat-chrome";

/**
 * The assistant has its own chrome — one thin bar, no store header, no footer.
 * It sits outside the (store) group for exactly that reason.
 */
export default function AssistantLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-void">
      <ChatChrome />
      {children}
    </div>
  );
}
