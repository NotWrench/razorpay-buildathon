"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/manager/manager-dialogs";
import { useAction } from "@/hooks/use-action";
import {
  deleteAddressAction,
  saveAddressAction,
  setPrimaryAddressAction,
} from "@/lib/actions/address";
import type { SavedAddress } from "@/lib/data/types";

/**
 * The address book.
 *
 * This section has been on the profile since the page was built, backed by a
 * hardcoded empty array and an Edit pill wired to nothing. It has a table
 * behind it now, so every control here does what it says.
 *
 * Rows on plain ground like the orders and the builds beside them — no card
 * wraps an address, and the default one is marked with a label rather than a
 * border, because a box around one of three addresses reads as selection
 * rather than as state.
 */

const FIELD =
  "t-body mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 text-bone outline-none transition-colors duration-micro placeholder:text-smoke focus:border-smoke";

interface Draft {
  city: string;
  id?: string;
  label: string;
  line1: string;
  line2: string;
  phone: string;
  pincode: string;
  state: string;
}

const EMPTY: Draft = {
  city: "",
  label: "",
  line1: "",
  line2: "",
  phone: "",
  pincode: "",
  state: "",
};

function toDraft(address: SavedAddress): Draft {
  return {
    city: address.city,
    id: address.id,
    label: address.label,
    line1: address.line1,
    line2: address.line2 ?? "",
    phone: address.phone ?? "",
    pincode: address.pincode,
    state: address.state,
  };
}

/**
 * One field. Controlled, deliberately.
 *
 * The manager's product sheet uses `defaultValue` and never reads the inputs
 * back, which is why nothing there saves. This holds its values in state so the
 * dialog can submit them.
 */
function Field({
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  name: keyof Draft;
  onChange: (name: keyof Draft, value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const handle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(name, event.target.value),
    [name, onChange]
  );

  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        className={FIELD}
        onChange={handle}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function AddressDialog({
  draft,
  onOpenChange,
  onSave,
  open,
  pending,
}: {
  draft: Draft;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: Draft) => void;
  open: boolean;
  pending: boolean;
}) {
  const [values, setValues] = useState(draft);

  const change = useCallback((name: keyof Draft, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  const save = useCallback(() => onSave(values), [onSave, values]);
  const cancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/80 backdrop-blur-[4px] transition-opacity duration-exit data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="surface-float fixed top-1/2 left-1/2 z-71 max-h-[92dvh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] bg-panel p-7 outline-none transition-opacity duration-standard data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-exit">
          <Dialog.Title className="t-display-sm text-bone">
            {draft.id ? "Edit address" : "Add an address"}
          </Dialog.Title>

          <div className="mt-6 grid gap-5">
            <Field
              label="Name it"
              name="label"
              onChange={change}
              placeholder="Home"
              value={values.label}
            />
            <Field
              label="Address"
              name="line1"
              onChange={change}
              placeholder="Flat, building, street"
              value={values.line1}
            />
            <Field
              label="Area"
              name="line2"
              onChange={change}
              placeholder="Locality, landmark"
              value={values.line2}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="City"
                name="city"
                onChange={change}
                value={values.city}
              />
              <Field
                label="State"
                name="state"
                onChange={change}
                value={values.state}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="PIN code"
                name="pincode"
                onChange={change}
                placeholder="560001"
                value={values.pincode}
              />
              <Field
                label="Phone"
                name="phone"
                onChange={change}
                placeholder="Optional"
                value={values.phone}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <Pill onClick={cancel} size="sm" variant="text">
              Cancel
            </Pill>
            <Pill disabled={pending} onClick={save} size="sm">
              {pending ? "Saving…" : "Save address"}
            </Pill>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddressRow({
  address,
  onDelete,
  onEdit,
  onSetPrimary,
}: {
  address: SavedAddress;
  onDelete: (address: SavedAddress) => void;
  onEdit: (address: SavedAddress) => void;
  onSetPrimary: (id: string) => void;
}) {
  const edit = useCallback(() => onEdit(address), [address, onEdit]);
  const remove = useCallback(() => onDelete(address), [address, onDelete]);
  const makeDefault = useCallback(
    () => onSetPrimary(address.id),
    [address.id, onSetPrimary]
  );

  const lines = [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.pincode}`,
    address.phone,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-4 py-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <p className="t-body text-bone">{address.label}</p>
          {address.primary ? <Label>Default</Label> : null}
        </div>
        {lines.map((line) => (
          <p className="t-body-sm mt-1 text-smoke" key={line}>
            {line}
          </p>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap gap-3">
        {address.primary ? null : (
          <Pill onClick={makeDefault} size="sm" variant="text">
            Make default
          </Pill>
        )}
        <Pill onClick={edit} size="sm" variant="ghost">
          Edit
        </Pill>
        <Pill
          className="text-ember hover:text-bone"
          onClick={remove}
          size="sm"
          variant="text"
        >
          Remove
        </Pill>
      </div>
    </div>
  );
}

function AddressList({
  addresses,
  slug,
}: {
  addresses: SavedAddress[];
  slug: string;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [doomed, setDoomed] = useState<SavedAddress | null>(null);

  const save = useAction(saveAddressAction, {
    onSuccess: () => setDraft(null),
    successMessage: "Address saved",
  });
  const remove = useAction(deleteAddressAction, {
    successMessage: "Address removed",
  });
  const primary = useAction(setPrimaryAddressAction);

  const add = useCallback(() => setDraft(EMPTY), []);
  const edit = useCallback(
    (address: SavedAddress) => setDraft(toDraft(address)),
    []
  );
  const closeDialog = useCallback((next: boolean) => {
    if (!next) {
      setDraft(null);
    }
  }, []);

  const onSave = useCallback(
    (values: Draft) =>
      save.run({
        addressId: values.id,
        city: values.city,
        label: values.label,
        line1: values.line1,
        line2: values.line2,
        phone: values.phone,
        pincode: values.pincode,
        slug,
        state: values.state,
      }),
    [save, slug]
  );

  const onSetPrimary = useCallback(
    (addressId: string) => primary.run({ addressId, slug }),
    [primary, slug]
  );

  const confirmDelete = useCallback(() => {
    if (doomed) {
      remove.run({ addressId: doomed.id, slug });
    }
  }, [doomed, remove, slug]);

  const closeConfirm = useCallback((next: boolean) => {
    if (!next) {
      setDoomed(null);
    }
  }, []);

  return (
    <div className="mt-6">
      {addresses.length === 0 ? (
        <p className="t-body py-5 text-smoke">No addresses saved yet.</p>
      ) : (
        addresses.map((address) => (
          <AddressRow
            address={address}
            key={address.id}
            onDelete={setDoomed}
            onEdit={edit}
            onSetPrimary={onSetPrimary}
          />
        ))
      )}

      <div className="mt-5">
        <Pill onClick={add} size="sm" variant="ghost">
          Add an address
        </Pill>
      </div>

      {/*
        Keyed on the address being edited so the dialog's internal state starts
        from the right values every time it opens. Without the key it would
        keep whatever was typed the last time it was open.
      */}
      {draft ? (
        <AddressDialog
          draft={draft}
          key={draft.id ?? "new"}
          onOpenChange={closeDialog}
          onSave={onSave}
          open
          pending={save.pending}
        />
      ) : null}

      <ConfirmDialog
        body={`${doomed?.label ?? "This address"} will be removed from your address book.`}
        confirmLabel="Remove address"
        onConfirm={confirmDelete}
        onOpenChange={closeConfirm}
        open={doomed !== null}
        title="Remove this address?"
      />
    </div>
  );
}

export { AddressList };
