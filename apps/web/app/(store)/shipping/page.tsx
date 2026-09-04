import type { Metadata } from "next";
import { ProsePage } from "@/components/common/prose-page";

export const metadata: Metadata = { title: "Shipping" };

export default function ShippingPage() {
  return (
    <ProsePage
      intro="Parts in stock dispatch the same day. Complete machines leave once they have been assembled and tested, which takes longer and is the point."
      kicker="Delivery"
      sections={[
        {
          body: (
            <p>
              Order a component before the day is out and it ships that day.
              Anything showing as in stock on its product page is on a shelf,
              not on its way to one.
            </p>
          ),
          heading: "Same-day dispatch on parts",
        },
        {
          body: (
            <p>
              A complete machine is assembled, wired, and run under load before
              it is packed. That is a few working days rather than a few hours,
              and it is the difference between a box of parts and a computer
              that works when you open it.
            </p>
          ),
          heading: "Builds take longer",
        },
        {
          body: (
            <p>
              Everything is shipped from Bengaluru. A graphics card travels in
              its own retail box inside ours; a complete machine travels with
              the card removed and packed separately, because a heavy card
              hanging off a slot is the single most common way a PC arrives
              broken.
            </p>
          ),
          heading: "How it travels",
        },
      ]}
      title="Shipping"
    />
  );
}
