import type { Metadata } from "next";
import { Archivo, Inter_Tight, JetBrains_Mono } from "next/font/google";

import "@workspace/ui/globals.css";
import { Toaster } from "@workspace/ui/components/sonner";
import { cn } from "@workspace/ui/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

/*
 * The three faces are exposed as *-face variables rather than as --font-sans
 * directly: next/font puts its variable on <html>, which is also :root, so a
 * same-named token in globals.css would be a source-order coin flip. The theme
 * reads these through var(--font-sans-face, fallback).
 */

const fontDisplay = Archivo({
  subsets: ["latin"],
  variable: "--font-display-face",
  weight: ["400", "500", "600", "700"],
});

const fontSans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans-face",
  weight: ["400", "500"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  weight: ["400"],
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
        fontDisplay.variable,
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
