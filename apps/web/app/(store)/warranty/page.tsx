import type { Metadata } from "next";
import { ProsePage } from "@/components/common/prose-page";

export const metadata: Metadata = { title: "Warranty" };

/**
 * The three figures here are the same ones every product page states in its
 * ownership block (`lib/data/product.ts`). They are quoted from one place so
 * the page and the product cannot disagree.
 */
export default function WarrantyPage() {
  return (
    <ProsePage
      intro="Three years on complete machines, seven days to change your mind, and the manufacturer's own term on individual parts."
      kicker="Ownership"
      sections={[
        {
          body: (
            <>
              <p>
                A machine we assemble carries a three-year warranty on the
                build itself: our labour, our cable work, and the parts we
                selected working together.
              </p>
              <p>
                Individual components keep whatever warranty their manufacturer
                gives them, which is usually longer than ours — often five
                years on memory and storage. Buying a part from us does not
                shorten it.
              </p>
            </>
          ),
          heading: "Three years on a build",
        },
        {
          body: (
            <p>
              Seven days from delivery, for any reason, provided the part is in
              a condition we could sell again. Send it back and we refund it to
              the method you paid with.
            </p>
          ),
          heading: "Seven-day returns",
        },
        {
          body: (
            <p>
              Tell us what the machine is doing and we will tell you which part
              is doing it. If a component has failed inside its warranty term
              we handle the replacement — you do not deal with the
              manufacturer.
            </p>
          ),
          heading: "If something fails",
        },
      ]}
      title="Warranty and returns"
    />
  );
}
