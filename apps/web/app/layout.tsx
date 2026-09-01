import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "@workspace/ui/globals.css";
import { Toaster } from "@workspace/ui/components/sonner";
import { cn } from "@workspace/ui/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const interHeading = Inter({ subsets: ["latin"], variable: "--font-heading" });

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
        fontMono.variable,
        "font-sans",
        geist.variable,
        interHeading.variable
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
