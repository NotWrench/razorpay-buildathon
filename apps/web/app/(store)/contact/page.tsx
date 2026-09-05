import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/common/prose-page";
import { shellRoutes } from "@/lib/routes";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <ProsePage
      intro="The assistant knows the catalogue, your cart and your orders, and answers immediately. For anything it cannot settle, a person will."
      kicker="Contact"
      sections={[
        {
          body: (
            <p>
              Ask it which of two cards suits your monitor, whether a cooler
              clears your memory, or where an order is.{" "}
              <Link
                className="text-bone underline-offset-4 transition-colors duration-micro hover:text-ember hover:underline"
                href={shellRoutes.assistant}
              >
                Open the assistant
              </Link>
              .
            </p>
          ),
          heading: "Ask the assistant",
        },
        {
          body: (
            <p>
              Write to{" "}
              <a
                className="text-bone underline-offset-4 transition-colors duration-micro hover:text-ember hover:underline"
                href="mailto:help@nexus.systems"
              >
                help@nexus.systems
              </a>{" "}
              and quote your order number if you have one. We answer within a
              working day.
            </p>
          ),
          heading: "Email",
        },
        {
          body: (
            <p>
              Nexus Systems, Bengaluru. Support runs Monday to Saturday; the
              assistant does not stop.
            </p>
          ),
          heading: "Where we are",
        },
      ]}
      title="Contact us"
    />
  );
}
