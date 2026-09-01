"use client";

import { Input } from "@workspace/ui/components/input";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { storeRoutes } from "@/lib/routes";

/**
 * Keyword search over the shelf.
 *
 * This is the deterministic path — it filters rows. The semantic one lives in
 * the assistant, which is the right place for "something quiet for a small
 * case": a search box that silently reinterprets what was typed is a search
 * box nobody can predict.
 */
export function SearchField({
  className,
  defaultValue,
  slug,
}: {
  className?: string;
  defaultValue?: string;
  slug: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();

    const query = value.trim();

    const routes = storeRoutes(slug);

    router.push(query ? routes.search(query) : routes.products);
  }

  return (
    <form className={className} onSubmit={submit} role="search">
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search products"
          className="pl-8"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search parts…"
          value={value}
        />
      </div>
    </form>
  );
}
