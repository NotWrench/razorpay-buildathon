import type { z } from "zod";

/**
 * An optional field the model is allowed to send as null.
 *
 * `gpt-oss` does not omit a field it is not using — it sends it as null. A
 * range question arrives with `"choices": null`, a buyer who has not named a
 * budget yet produces `{"budgetRupees": null}`, and Zod's `.optional()`
 * rejects every one of them. The turn then dies on a field the model was
 * explicitly declining to use, which is the most avoidable way to lose a
 * conversation: nothing was wrong with the call.
 *
 * Fixing these one at a time as they are tripped over does not converge —
 * there is no field the model will not do this to — so optionality is spelled
 * this way throughout the tool schemas instead of with `.optional()`.
 *
 * The transform is what keeps this invisible to everything downstream: null
 * and absent both parse to `undefined`, so a tool's `execute` still sees
 * `T | undefined` and no caller has to learn a third case for "the model said
 * null". Null means "not provided" here, which is what the model means by it.
 *
 * Describe on the outside — `optional(z.number()).describe("…")` — so the
 * description lands on the property rather than inside one branch of the
 * generated `anyOf`.
 */
export function optional<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((value) => value ?? undefined);
}
