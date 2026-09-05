"use client";

import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/manager/manager-dialogs";
import { useAction } from "@/hooks/use-action";
import { useCartActions } from "@/hooks/use-cart-actions";
import { deleteBuildAction } from "@/lib/actions/build";
import type { SavedBuild } from "@/lib/data/types";

/**
 * Saved builds, as rows rather than cards.
 *
 * The list only ever grew: there was no way to remove a build, and the "Add to
 * cart" pill beside each one had no handler at all even though the action it
 * needed already existed. Both work now.
 *
 * Nothing here is filled. Adding a build to a basket and throwing one away are
 * both ordinary moves, and this page's one solid pill is not on it — removal is
 * red text rather than a red button, which is the weight it deserves next to
 * four other controls.
 */

function BuildRow({
  build,
  onAdd,
  onDelete,
  pending,
}: {
  build: SavedBuild;
  onAdd: (buildId: string) => void;
  onDelete: (build: SavedBuild) => void;
  pending: boolean;
}) {
  const add = useCallback(() => onAdd(build.id), [build.id, onAdd]);
  const remove = useCallback(() => onDelete(build), [build, onDelete]);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-5">
      <div className="min-w-0 flex-1">
        <p className="t-body truncate text-bone">{build.name}</p>
        <p className="t-num-xs mt-1 text-smoke">
          {build.partCount} parts · {formatPaise(build.totalPaise)}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-3">
        <Pill disabled={pending} onClick={add} size="sm" variant="ghost">
          Add to cart
        </Pill>
        <Pill
          className="text-ember hover:text-bone"
          onClick={remove}
          size="sm"
          variant="text"
        >
          Delete
        </Pill>
      </div>
    </div>
  );
}

function SavedBuilds({ builds, slug }: { builds: SavedBuild[]; slug: string }) {
  const [doomed, setDoomed] = useState<SavedBuild | null>(null);
  const cart = useCartActions(slug);
  const remove = useAction(deleteBuildAction, {
    successMessage: "Build deleted",
  });

  const confirmDelete = useCallback(() => {
    if (doomed) {
      remove.run({ buildId: doomed.id, slug });
    }
  }, [doomed, remove, slug]);

  const closeConfirm = useCallback((next: boolean) => {
    if (!next) {
      setDoomed(null);
    }
  }, []);

  if (builds.length === 0) {
    return <p className="t-body mt-6 text-smoke">No builds saved yet.</p>;
  }

  return (
    <div className="mt-6">
      {builds.map((build) => (
        <BuildRow
          build={build}
          key={build.id}
          onAdd={cart.addBuild}
          onDelete={setDoomed}
          pending={cart.pending}
        />
      ))}

      <ConfirmDialog
        body={`${doomed?.name ?? "This build"} and its parts list will be deleted. Anything already in your cart stays there.`}
        confirmLabel="Delete build"
        onConfirm={confirmDelete}
        onOpenChange={closeConfirm}
        open={doomed !== null}
        title="Delete this build?"
      />
    </div>
  );
}

export { SavedBuilds };
