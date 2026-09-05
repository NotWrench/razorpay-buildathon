import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@workspace/ui/globals.css";
import { Toaster } from "@workspace/ui/components/sonner";
import { cn } from "@workspace/ui/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

/*
 * Two faces from one family.
 *
 * The site briefly ran on a monospace alone. A monospace is a wonderful thing
 * for a column of prices and a poor one for a paragraph: every glyph gets the
 * same width whether it needs it or not, so `i` floats in space, `m` is
 * squeezed, and the word shapes an eye reads by stop being shapes. It looked
 * like a terminal pretending to be a shop.
 *
 * Geist and Geist Mono are drawn as one family, which is the point — they
 * share proportions, weights and vertical metrics, so a price in mono sitting
 * beside a name in sans reads as the same voice rather than two fonts in a
 * room together. The technical feel the mono was there for survives, in the
 * places where it means something: numbers, labels, and the machine name.
 *
 * Both are exposed as *-face variables rather than as --font-sans directly:
 * next/font puts its variable on <html>, which is also :root, so a same-named
 * token in globals.css would be a source-order coin flip. The theme reads them
 * through var(--font-sans-face, fallback).
 */

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans-face",
  weight: ["400", "500", "600", "700"],
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  description:
    "A PC parts store with a grounded shopping agent and a deterministic compatibility engine.",
  title: {
    default: "Agentic PC Commerce",
    template: "%s · Agentic PC Commerce",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={cn(
        "antialiased",
        "font-sans",
        fontSans.variable,
        fontMono.variable
      )}
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          {children}
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
