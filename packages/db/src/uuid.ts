/**
 * Whether a string can be a uuid at all.
 *
 * Every id in this schema is a `uuid` column, and Postgres does not decline a
 * malformed one politely — it raises `22P02 invalid input syntax for type
 * uuid`, which surfaces as a 500 on a route whose honest answer was 404. A
 * stale link, a hand-typed URL and a truncated id are all ordinary things for
 * a public storefront to be sent; none of them is a server fault.
 *
 * So callers that take an id from a URL check the shape first and treat a
 * failure as "no such row". This lives in `@workspace/db` because that is
 * where the constraint comes from — the format is a property of the column,
 * not of any one caller.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}
