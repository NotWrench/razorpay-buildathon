import { getMerchantBySlug, listActiveProducts } from "@workspace/ai";
import { notFound } from "next/navigation";
import { StorefrontChat } from "@/components/chat/storefront-chat";
import { formatPaise } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The storefront.
 *
 * Chat is the primary surface, with the catalog beside it as evidence: the
 * assistant's claims should be checkable against a visible shelf, not taken on
 * trust.
 */
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let merchant: Awaited<ReturnType<typeof getMerchantBySlug>>;

  try {
    merchant = await getMerchantBySlug(slug);
  } catch {
    notFound();
  }

  const products = await listActiveProducts(merchant.id, { limit: 60 });

  const categories = [
    ...new Set(
      products
        .map((product) => product.category)
        .filter((category): category is string => Boolean(category))
    ),
  ];

  return (
    <div className="mx-auto flex h-svh max-w-6xl flex-col">
      <header className="flex items-baseline justify-between border-border border-b px-4 py-3">
        <div>
          <h1 className="font-semibold text-lg">{merchant.businessName}</h1>
          <p className="text-muted-foreground text-xs">
            {products.length} products · {categories.join(" · ")}
          </p>
        </div>
        <a
          className="text-muted-foreground text-xs underline underline-offset-4 hover:text-foreground"
          href={`/store/${slug}/catalog.json`}
          rel="noreferrer"
          target="_blank"
        >
          catalog.json
        </a>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_320px]">
        <main className="min-h-0 border-border lg:border-r">
          <StorefrontChat slug={slug} storeName={merchant.businessName} />
        </main>

        <aside className="hidden min-h-0 overflow-y-auto p-4 lg:block">
          <h2 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
            In the shop
          </h2>
          <ul className="space-y-2">
            {products.map((product) => (
              <li
                className="rounded-sm border border-border/60 p-2 text-sm"
                key={product.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="leading-tight">{product.name}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    {formatPaise(product.price, merchant.currency)}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {product.stock > 0
                    ? `${product.stock} in stock`
                    : "Out of stock"}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
