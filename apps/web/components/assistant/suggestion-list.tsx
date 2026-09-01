"use client";

import { Button } from "@workspace/ui/components/button";

/** The opening prompts, shown only while the thread is empty. */
export function SuggestionList({
  onPick,
  suggestions,
}: {
  onPick: (text: string) => void;
  suggestions: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion}
          onClick={() => onPick(suggestion)}
          size="xs"
          variant="outline"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
