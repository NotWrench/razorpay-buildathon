import { ShoppingCartIcon } from "lucide-react";
import { ButtonLink } from "@/components/common/button-link";
import { storeRoutes } from "@/lib/routes";

/** The basket link, with what is in it. Rendered on the server, so it is never stale. */
export function CartButton({ count, slug }: { count: number; slug: string }) {
  return (
    <ButtonLink href={storeRoutes(slug).cart} size="sm" variant="outline">
      <ShoppingCartIcon />
      Cart
      {count > 0 ? (
        <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-2xs text-primary-foreground tabular-nums">
          {count}
        </span>
      ) : null}
    </ButtonLink>
  );
}
