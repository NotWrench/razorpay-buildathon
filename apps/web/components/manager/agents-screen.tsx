"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Ban, Copy } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/manager/manager-dialogs";
import { ManagerHeading } from "@/components/manager/manager-heading";
import type { ManagerColumn } from "@/components/manager/manager-table";
import { ManagerTable, RowAction } from "@/components/manager/manager-table";
import { useAction } from "@/hooks/use-action";
import {
  issueAgentKeyAction,
  revokeAgentKeyAction,
} from "@/lib/actions/agents";
import type { AgentKeyRow } from "@/lib/data/types";

/**
 * The merchant's AI customers, and what each of them is allowed to spend.
 *
 * The discovery manifest has always told counterparties to "issue a key from
 * the merchant dashboard" and there was no such place. This is it — and it is
 * a relationship screen rather than a token generator, because the interesting
 * column is not the key, it is how often this merchant says yes to that agent.
 *
 * A cap here is the difference between a bound the deployment sets for
 * everybody and a bound this shop sets for this counterparty. Trusting one
 * agent with ₹2 lakh and another with ₹5,000 is what having customers means.
 */

const PAISE_PER_RUPEE = 100;

const keyRow = (row: AgentKeyRow) => row.id;

function KeyActions({
  onRevoke,
  row,
}: {
  onRevoke: (row: AgentKeyRow) => void;
  row: AgentKeyRow;
}) {
  const revoke = useCallback(() => onRevoke(row), [onRevoke, row]);

  if (row.revoked) {
    return null;
  }

  return (
    <RowAction label={`Revoke ${row.label}`} onClick={revoke} tone="lacquer">
      <Ban aria-hidden className="size-3.5" />
    </RowAction>
  );
}

/**
 * The secret, shown once and never again.
 *
 * Not stored anywhere this app can read back — a screen that can re-display a
 * key leaks every key it ever issued to whoever reaches it. So the copy button
 * matters: this panel is the only chance the merchant gets.
 */
function IssuedKey({ secret }: { secret: string }) {
  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(secret)
      .then(() => toast.success("Copied. This is the only time it is shown."))
      .catch(() => toast.error("Could not copy — select it by hand."));
  }, [secret]);

  return (
    <div className="mb-10 rounded-[18px] border border-amber/40 bg-amber/5 p-6">
      <Label>Copy this now</Label>
      <p className="t-body-sm mt-3 text-smoke">
        This is the only time the key is shown. It is not stored anywhere we can
        read it back, so if it is lost you issue a new one.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-bone">
          {secret}
        </code>
        <Pill onClick={copy} size="sm" variant="ghost">
          <Copy aria-hidden className="size-3.5" />
          Copy
        </Pill>
      </div>
    </div>
  );
}

function AgentsScreen({
  keys,
  merchantId,
}: {
  keys: AgentKeyRow[];
  merchantId: string;
}) {
  const [issued, setIssued] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<AgentKeyRow | null>(null);

  const issue = useAction(issueAgentKeyAction, {
    onSuccess: ({ key }) => setIssued(key),
  });

  const revoke = useAction(revokeAgentKeyAction, {
    onSuccess: () => setRevoking(null),
    successMessage: "Revoked. What it already bought still shows here.",
  });

  const onIssue = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const form = new FormData(event.currentTarget);
      const rupees = Number(String(form.get("cap") ?? "").trim());

      issue.run({
        label: String(form.get("label") ?? "").trim(),
        merchantId,
        // Blank means "the platform default", which is a real choice and not
        // the same as zero.
        spendCapPaise:
          Number.isFinite(rupees) && rupees > 0
            ? Math.round(rupees * PAISE_PER_RUPEE)
            : undefined,
      });

      event.currentTarget.reset();
    },
    [issue, merchantId]
  );

  const onRevokeConfirm = useCallback(() => {
    if (revoking) {
      revoke.run({ keyId: revoking.id, merchantId });
    }
  }, [merchantId, revoke, revoking]);

  const onRevokeOpen = useCallback(
    (open: boolean) => setRevoking(open ? revoking : null),
    [revoking]
  );

  const columns = useMemo<ManagerColumn<AgentKeyRow>[]>(
    () => [
      {
        id: "label",
        label: "Agent",
        render: (row) => (
          <div className="min-w-0">
            <p className={cn("t-body truncate", row.revoked && "text-smoke")}>
              {row.label}
              {row.revoked ? " · revoked" : ""}
            </p>
            <p className="mt-0.5 font-mono text-[13px] text-smoke">
              {row.prefix}
            </p>
          </div>
        ),
        sort: (a, b) => a.label.localeCompare(b.label),
        width: "auto",
      },
      {
        align: "right",
        id: "orders",
        label: "Orders",
        render: (row) => (
          <span className="font-mono text-[15px] text-bone tabular-nums">
            {row.orders.total}
          </span>
        ),
        sort: (a, b) => a.orders.total - b.orders.total,
        width: "6rem",
      },
      {
        align: "right",
        id: "waiting",
        label: "Waiting",
        render: (row) => (
          <span
            className={cn(
              "font-mono text-[15px] tabular-nums",
              row.orders.pending > 0 ? "text-amber" : "text-smoke"
            )}
          >
            {row.orders.pending}
          </span>
        ),
        sort: (a, b) => a.orders.pending - b.orders.pending,
        width: "6rem",
      },
      {
        align: "right",
        id: "spent",
        label: "Committed",
        render: (row) => (
          <span className="font-mono text-[15px] text-bone tabular-nums">
            {formatPaise(row.spentPaise)}
          </span>
        ),
        sort: (a, b) => a.spentPaise - b.spentPaise,
        width: "9rem",
      },
      {
        align: "right",
        id: "cap",
        label: "Cap",
        render: (row) => (
          <span className="font-mono text-[15px] text-smoke tabular-nums">
            {/* A key with no cap of its own falls back to the platform's, and
                saying "default" is more honest than printing that number here
                as though this merchant had chosen it. */}
            {row.spendCapPaise === null
              ? "default"
              : formatPaise(row.spendCapPaise)}
          </span>
        ),
        width: "9rem",
      },
    ],
    []
  );

  const actions = useCallback(
    (row: AgentKeyRow) => <KeyActions onRevoke={setRevoking} row={row} />,
    []
  );

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading count={`${keys.length} issued`} title="Agent buyers" />

      {issued ? <IssuedKey secret={issued} /> : null}

      <form
        className="mb-12 flex flex-wrap items-end gap-5 border-hairline border-b pb-10"
        onSubmit={onIssue}
      >
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="agent-label">Who is this for</Label>
          <input
            className="t-body mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 text-bone outline-none transition-colors duration-micro placeholder:text-smoke focus:border-bone"
            id="agent-label"
            name="label"
            placeholder="Acme shopping agent"
            required
          />
        </div>

        <div className="w-[220px]">
          <Label htmlFor="agent-cap">Spending limit in rupees</Label>
          <input
            className="t-body mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 font-mono text-bone tabular-nums outline-none transition-colors duration-micro placeholder:text-smoke focus:border-bone"
            id="agent-cap"
            inputMode="numeric"
            name="cap"
            placeholder="Leave blank for default"
          />
        </div>

        <Pill disabled={issue.pending} size="sm" type="submit">
          {issue.pending ? "Issuing…" : "Issue key"}
        </Pill>
      </form>

      <ManagerTable
        actions={actions}
        columns={columns}
        empty={
          <p className="t-body-lg text-smoke">
            No agent keys yet. Issue one above and hand it to a buying agent —
            it identifies them to this store and nothing else.
          </p>
        }
        rowKey={keyRow}
        rows={keys}
      />

      <ConfirmDialog
        body={`${revoking?.label ?? "This key"} stops working immediately. Orders it already placed stay in your history, and anything of its still waiting on you can still be approved or rejected.`}
        confirmLabel="Revoke"
        onConfirm={onRevokeConfirm}
        onOpenChange={onRevokeOpen}
        open={revoking !== null}
        title="Revoke this key"
      />
    </div>
  );
}

export { AgentsScreen };
