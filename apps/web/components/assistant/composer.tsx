"use client";

import { Button } from "@workspace/ui/components/button";
import { SendHorizontalIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

/** The message box. Owns its own draft so a streaming turn cannot clear it. */
export function Composer({
  busy,
  onSend,
  placeholder = "Ask anything…",
}: {
  busy: boolean;
  onSend: (text: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();

    const text = draft.trim();

    if (!text || busy) {
      return;
    }

    onSend(text);
    setDraft("");
  }

  return (
    <form className="flex gap-2 border-border border-t p-3" onSubmit={submit}>
      <input
        aria-label="Message"
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        value={draft}
      />
      <Button
        aria-label="Send"
        disabled={busy || !draft.trim()}
        size="icon"
        type="submit"
      >
        <SendHorizontalIcon />
      </Button>
    </form>
  );
}
