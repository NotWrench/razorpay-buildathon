import { Badge } from "@workspace/ui/components/badge";

/**
 * Order and approval state, side by side.
 *
 * Both are shown because they answer different questions: `approvalStatus`
 * says whether the merchant has let the order through, `orderStatus` says
 * whether money has actually moved. An agent order can be created, unapproved
 * and unpaid all at once, and collapsing that into one word loses the part the
 * buyer is waiting on.
 */

const ORDER_TONES: Record<string, string> = {
  cancelled: "border-border bg-muted text-muted-foreground",
  created: "border-border",
  draft: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const APPROVAL_TONES: Record<string, string> = {
  approved:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pending_approval:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
};

const APPROVAL_LABELS: Record<string, string> = {
  approved: "Approved",
  pending_approval: "Awaiting approval",
  rejected: "Rejected",
};

export function OrderStatusBadge({
  approvalStatus,
  orderStatus,
}: {
  approvalStatus: string;
  orderStatus: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge className={ORDER_TONES[orderStatus]} variant="outline">
        {orderStatus}
      </Badge>
      {approvalStatus === "approved" && orderStatus !== "draft" ? null : (
        <Badge className={APPROVAL_TONES[approvalStatus]} variant="outline">
          {APPROVAL_LABELS[approvalStatus] ?? approvalStatus}
        </Badge>
      )}
    </span>
  );
}
