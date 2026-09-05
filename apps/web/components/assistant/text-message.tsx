import { Markdown } from "@/components/chat/markdown";

/**
 * One text part.
 *
 * Two presentations, because the two rooms are not the same room. On the
 * storefront the buyer's own words get a filled bubble, the way a chat looks.
 * In the manager's room nothing is filled — a lacquer bubble would be the
 * loudest thing on a page whose whole job is to be calm — so the question is
 * set quietly above the answer instead.
 *
 * The buyer's own line stays plain text: they typed it, they know what it
 * says, and running their words through a parser only means a stray asterisk
 * or a pasted `#` comes back looking like something they did not write. The
 * assistant's half is markdown, which is what the model writes.
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
    return role === "user" ? (
      <p className="text-[15px] text-smoke">{text}</p>
    ) : (
      <Markdown className="text-[16px] text-bone" text={text} />
    );
  }

  if (role === "user") {
    return (
      <p className="ml-auto w-fit max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm">
        {text}
      </p>
    );
  }

  return <Markdown className="text-sm" text={text} />;
}
