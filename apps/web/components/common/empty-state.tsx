import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Nothing here, and what to do about it. */
export function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  description?: string;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-border border-dashed px-6 py-14 text-center">
      {Icon ? <Icon className="size-6 text-muted-foreground" /> : null}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-muted-foreground text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
