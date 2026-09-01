/**
 * What a server action hands back to a client component.
 *
 * A thrown error in an action reaches the client as an opaque digest, which is
 * useless to a shopper who just wants to know the card would not fit. Anything
 * the buyer can act on comes back as a value instead, and only genuinely
 * unexpected failures are allowed to throw.
 */

export interface ActionOk<T = undefined> {
  data: T;
  ok: true;
}

export interface ActionFailed {
  message: string;
  ok: false;
}

export type ActionResult<T = undefined> = ActionOk<T> | ActionFailed;

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { data, ok: true };
}

export function failed(message: string): ActionFailed {
  return { message, ok: false };
}
