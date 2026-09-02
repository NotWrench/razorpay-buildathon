import type { Metadata } from "next";
import { ChatScreen } from "@/components/chat/chat-screen";

export const metadata: Metadata = {
  description: "Describe what you need and the assistant builds it.",
  title: "Assistant",
};

export default function AssistantPage() {
  return <ChatScreen />;
}
