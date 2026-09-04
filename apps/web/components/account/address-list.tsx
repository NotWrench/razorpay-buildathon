import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import type { SavedAddress } from "@/lib/data/types";

/**
 * The rail names five sections and this is the fifth.
 *
 * A rail item that leads nowhere is worse than one fewer rail item, so the
 * addresses are a block on the profile like the orders and the builds are —
 * two rows, plain text, a ghost pill to edit.
 */
function AddressList({ addresses }: { addresses: SavedAddress[] }) {
  return (
    <div className="mt-6 border-hairline border-t">
      {addresses.map((address) => (
        <div
          className="flex flex-wrap items-start gap-x-6 gap-y-4 border-hairline border-b py-5"
          key={address.id}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <p className="t-body text-bone">{address.label}</p>
              {address.primary ? <Label>Default</Label> : null}
            </div>
            {address.lines.map((line) => (
              <p className="t-body-sm mt-1 text-smoke" key={line}>
                {line}
              </p>
            ))}
          </div>

          <Pill size="sm" variant="ghost">
            Edit
          </Pill>
        </div>
      ))}
    </div>
  );
}

export { AddressList };
