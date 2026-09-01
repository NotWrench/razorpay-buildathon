import { cn } from "@workspace/ui/lib/utils";

/** One text part. The buyer's own words get a bubble; the agent's do not. */
export function TextMessage({ role, text }: { role: string; text: string }) {
  return (
    <p
      className={cn(
        "text-sm",
        role === "user"
          ? "ml-auto w-fit max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground"
          : "whitespace-pre-wrap leading-relaxed"
      )}
    >
      {text}
    </p>
  );
}
