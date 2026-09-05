"use client";

import { cn } from "@workspace/ui/lib/utils";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The assistant's words, as markdown.
 *
 * The model writes in markdown whether or not anything renders it — headings,
 * bullets, a comparison table, `**bold**` around the part it wants read first.
 * Rendered as plain text that is noise: asterisks around product names, pipes
 * standing in for a table, a numbered list with its numbers hard against the
 * left edge. So the same string is parsed here instead.
 *
 * Two rules shape the element map below:
 *
 *   1. No size and no face. Every caller already sets one — `t-body-lg` in the
 *      full assistant, `text-sm` in the panels — and a renderer that re-spelled
 *      the scale would make the same paragraph two different sizes in two
 *      rooms. Headings and code are the exceptions: relative sizes only (`em`),
 *      so a heading is proportional to whatever body it sits in.
 *   2. Semantic colour tokens, never `bone`/`smoke` directly, for the same
 *      reason — the merchant panel is shadcn's palette and the storefront is
 *      the bespoke one, and `--foreground` is the name both answer to.
 *
 * Raw HTML is not enabled. The text is model output, some of it shaped by
 * product rows and buyer input, and `rehype-raw` on that path is an injection
 * hole for the sake of markup nobody asked the model to write.
 */

/** A fenced block, as `react-markdown` labels it on the inner `code`. */
const FENCED = /language-/;

/** Spacing that collapses at the ends, so a block never pads its container. */
const BLOCK = "my-3 first:mt-0 last:mb-0";

const COMPONENTS: Components = {
  a: ({ children, href }) => (
    <a
      className="underline decoration-current/40 underline-offset-2 transition-colors hover:decoration-current"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ),

  blockquote: ({ children }) => (
    <blockquote
      className={cn(BLOCK, "border-border border-l pl-3 text-muted-foreground")}
    >
      {children}
    </blockquote>
  ),

  /*
   * One component for both kinds of code. `pre` supplies the block frame and
   * the horizontal scroll; the `code` inside it inherits, so the inline chip's
   * padding and background have to be dropped there or every fenced block
   * gets a second box drawn inside the first.
   */
  code: ({ children, className }) => {
    const fenced = FENCED.test(className ?? "");

    return (
      <code
        className={cn(
          "font-mono text-[0.9em]",
          fenced
            ? "block"
            : "rounded-sm bg-muted px-1 py-0.5 text-foreground/90"
        )}
      >
        {children}
      </code>
    );
  },

  em: ({ children }) => <em className="italic">{children}</em>,

  h1: ({ children }) => (
    <h1 className={cn(BLOCK, "font-semibold text-[1.25em] text-foreground")}>
      {children}
    </h1>
  ),

  h2: ({ children }) => (
    <h2 className={cn(BLOCK, "font-semibold text-[1.15em] text-foreground")}>
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3 className={cn(BLOCK, "font-semibold text-[1.05em] text-foreground")}>
      {children}
    </h3>
  ),

  h4: ({ children }) => (
    <h4 className={cn(BLOCK, "font-semibold text-foreground")}>{children}</h4>
  ),

  h5: ({ children }) => (
    <h5 className={cn(BLOCK, "font-semibold text-foreground")}>{children}</h5>
  ),

  h6: ({ children }) => (
    <h6 className={cn(BLOCK, "font-semibold text-foreground")}>{children}</h6>
  ),

  hr: () => <hr className="my-4 border-border" />,

  /*
   * An image the model wrote a URL for is not a product shot the app chose to
   * show, so it stays a link. It also means no remote host gets a request —
   * and no layout gets shifted — on the strength of a generated string.
   */
  img: ({ alt, src }) => (
    <a
      className="underline decoration-current/40 underline-offset-2"
      href={typeof src === "string" ? src : undefined}
      rel="noreferrer"
      target="_blank"
    >
      {alt || "image"}
    </a>
  ),

  li: ({ children }) => <li className="my-1 pl-1">{children}</li>,

  ol: ({ children }) => (
    <ol className={cn(BLOCK, "list-decimal pl-5")}>{children}</ol>
  ),

  p: ({ children }) => (
    <p className={cn(BLOCK, "leading-relaxed")}>{children}</p>
  ),

  pre: ({ children }) => (
    <pre
      className={cn(
        BLOCK,
        "overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-[0.9em] leading-relaxed"
      )}
    >
      {children}
    </pre>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),

  /*
   * A comparison table is the one thing the model writes that genuinely needs
   * the width, and the thread is a narrow column. It scrolls on its own rather
   * than pushing the page sideways.
   */
  table: ({ children }) => (
    <div className={cn(BLOCK, "-mx-1 overflow-x-auto px-1")}>
      <table className="w-full border-collapse text-left text-[0.95em]">
        {children}
      </table>
    </div>
  ),

  td: ({ children }) => (
    <td className="border-border border-b px-2 py-1.5 align-top">{children}</td>
  ),

  th: ({ children }) => (
    <th className="border-border border-b px-2 py-1.5 font-medium text-muted-foreground">
      {children}
    </th>
  ),

  ul: ({ children }) => (
    <ul className={cn(BLOCK, "list-disc pl-5")}>{children}</ul>
  ),
};

const PLUGINS = [remarkGfm];

function MarkdownImpl({
  className,
  text,
}: {
  className?: string;
  /** Raw markdown. Mid-stream and half-written is expected and fine. */
  text: string;
}) {
  return (
    <div className={cn("min-w-0 break-words", className)}>
      <ReactMarkdown components={COMPONENTS} remarkPlugins={PLUGINS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Memoised on the text.
 *
 * A streaming turn re-renders the whole thread on every token, and re-parsing
 * every finished message each time is work whose answer cannot have changed.
 */
const Markdown = memo(MarkdownImpl);

export { Markdown };
