"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Running a server action from a client component.
 *
 * Server actions revalidate on the server, so the UI does not hold a second
 * copy of the cart or the build to keep in step — this only tracks whether a
 * call is in flight and surfaces the failure the action chose to return.
 * Everything the shopper sees still comes from the server's render.
 */

interface UseActionOptions<T> {
  onSuccess?: (data: T) => void;
  /** Shown as a toast on success. Omit for actions that speak for themselves. */
  successMessage?: string;
}

export function useAction<Input, Data>(
  action: (input: Input) => Promise<ActionResult<Data>>,
  options: UseActionOptions<Data> = {}
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (input: Input) => {
      setError(null);

      startTransition(async () => {
        const result = await action(input);

        if (result.ok) {
          if (options.successMessage) {
            toast.success(options.successMessage);
          }

          options.onSuccess?.(result.data);

          return;
        }

        setError(result.message);
        toast.error(result.message);
      });
    },
    [action, options]
  );

  return { error, pending, run };
}
