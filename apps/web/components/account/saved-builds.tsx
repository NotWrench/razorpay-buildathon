import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { PillLink } from "@/components/common/pill-link";
import type { SavedBuild } from "@/lib/data/types";
import { shellRoutes } from "@/lib/routes";

/**
 * Saved builds, as rows rather than cards.
 *
 * Two ghost pills each and nothing filled: opening a build and adding it to a
 * cart are both ordinary moves, and this page's one solid pill is not on it.
 */
function SavedBuilds({ builds }: { builds: SavedBuild[] }) {
  return (
    <div className="mt-6 border-hairline border-t">
      {builds.map((build) => (
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-4 border-hairline border-b py-5"
          key={build.id}
        >
          <div className="min-w-0 flex-1">
            <p className="t-body truncate text-bone">{build.name}</p>
            <p className="t-num-xs mt-1 text-smoke">
              {build.partCount} parts · {formatPaise(build.totalPaise)}
            </p>
          </div>

          <div className="flex shrink-0 gap-3">
            <PillLink href={shellRoutes.assistant} size="sm" variant="ghost">
              Open
            </PillLink>
            <Pill size="sm" variant="ghost">
              Add to cart
            </Pill>
          </div>
        </div>
      ))}
    </div>
  );
}

export { SavedBuilds };
