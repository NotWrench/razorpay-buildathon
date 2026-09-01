import { Button } from "@workspace/ui/components/button";
import { ShoppingCartIcon } from "lucide-react";
import Link from "next/link";

/** The basket link, with what is in it. Rendered on the server, so it is never stale. */
export function CartButton({ count, slug }: { count: number; slug: string }) {
  return (
    <Button
      render={<Link href={`/store/${slug}/cart`} />}
      size="sm"
      variant="outline"
    >
      <ShoppingCartIcon />
      Cart
      {count > 0 ? (
        <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground tabular-nums">
          {count}
        </span>
      ) : null}
    </Button>
  );
}
