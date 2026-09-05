import { cn } from "@workspace/ui/lib/utils";

/**
 * One text part.
 *
 * Two presentations, because the two rooms are not the same room. On the
 * storefront the buyer's own words get a filled bubble, the way a chat looks.
 * In the manager's room nothing is filled — a lacquer bubble would be the
 * loudest thing on a page whose whole job is to be calm — so the question is
 * set quietly above the answer instead.
 */
export function TextMessage({
  role,
  text,
  variant = "bubble",
}: {
  role: string;
  text: string;
  variant?: "bubble" | "plain";
}) {
  if (variant === "plain") {
    return (
      <p
        className={cn(
          role === "user"
            ? "text-[15px] text-smoke"
            : "whitespace-pre-wrap text-[16px] text-bone leading-relaxed"
        )}
      >
        {text}
      </p>
    );
  }

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
