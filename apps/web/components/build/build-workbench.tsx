"use client";

import type { BuildValidation } from "@workspace/commerce/compatibility";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAction } from "@/hooks/use-action";
import {
  removeBuildPartAction,
  setBuildPartAction,
} from "@/lib/actions/build";
import type { BuildSlotEntry } from "@/lib/queries/builds";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { storeRoutes } from "@/lib/routes";
import { SlotRow } from "./slot-row";

/**
 * The slot list, and the two actions that change it.
 *
 * State is not held here. Every edit is a server action that rewrites the
 * build and re-runs the engine, and the page re-renders with the result — so
 * the compatibility report beside this list is always the verdict on the parts
 * actually stored, never on a client-side guess about them.
 */

export interface SlotDefinition {
  categorySlug: string;
  name: string;
  required: boolean;
}

export function BuildWorkbench({
  buildId,
  candidatesByCategory,
  entries,
  slots,
  slug,
  validation,
}: {
  buildId: string | null;
  candidatesByCategory: Record<string, CatalogProduct[]>;
  entries: BuildSlotEntry[];
  slots: SlotDefinition[];
  slug: string;
  validation: BuildValidation;
}) {
  const router = useRouter();

  const setPart = useAction(setBuildPartAction, {
    onSuccess: (data) => {
      // A build created by the first pick needs to become the page's build,
      // otherwise the next pick would start a second one.
      if (!buildId && data?.buildId) {
        router.replace(storeRoutes(slug).buildWith(data.buildId));
      }
    },
  });

  const removePart = useAction(removeBuildPartAction);

  /** Products a finding named, so the rows they sit in can be marked. */
  const affected = useMemo(
    () =>
      new Set(
        validation.issues
          .filter((issue) => issue.severity !== "info")
          .flatMap((issue) => issue.affectedProductIds)
      ),
    [validation.issues]
  );

  const pending = setPart.pending || removePart.pending;

  return (
    <div className="rounded-md border border-border">
      {slots.map((slot) => (
        <SlotRow
          affected={affected}
          candidates={candidatesByCategory[slot.categorySlug] ?? []}
          categoryName={slot.name}
          entries={entries.filter(
            (entry) => entry.categorySlug === slot.categorySlug
          )}
          key={slot.categorySlug}
          onPick={(productId) =>
            setPart.run({ buildId: buildId ?? undefined, productId, slug })
          }
          onRemove={(productId) =>
            buildId && removePart.run({ buildId, productId, slug })
          }
          pending={pending}
          required={slot.required}
          slug={slug}
        />
      ))}
    </div>
  );
}
