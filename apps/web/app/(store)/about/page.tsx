import type { Metadata } from "next";
import { ProsePage } from "@/components/common/prose-page";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <ProsePage
      intro="We sell PC components, and we build complete machines out of them. Those are the same catalogue, priced the same way."
      kicker="Nexus Systems"
      sections={[
        {
          body: (
            <>
              <p>
                Every part on this site is one we would put in a machine we
                ship. There is no separate tier of parts kept aside for
                pre-builts, and no house-brand power supply standing in for a
                real one.
              </p>
              <p>
                A pre-built is a parts list we have already checked, assembled
                and tested. You can open any of them, see exactly what is
                inside, and change it.
              </p>
            </>
          ),
          heading: "One catalogue",
        },
        {
          body: (
            <p>
              The compatibility checks that run in the builder are the same
              ones we run before a machine leaves the bench: socket and
              chipset, memory type and slot count, case and cooler clearance,
              power headroom and connector count, storage interfaces. If a
              combination will not work, the builder says so before you pay
              rather than after it arrives.
            </p>
          ),
          heading: "Checked before it ships",
        },
        {
          body: (
            <p>
              Prices are what you pay. GST is included in the figure shown on
              the product, in the cart and at checkout — there is no tax added
              at the last step.
            </p>
          ),
          heading: "Prices",
        },
      ]}
      title="Parts, and the machines we make from them"
    />
  );
}
