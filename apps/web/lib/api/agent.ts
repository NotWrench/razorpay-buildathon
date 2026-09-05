import type { AgentActor } from "@workspace/ai";
import type { Actor } from "./actor";

/**
 * Narrows the route-level actor to the shape the agent package needs.
 *
 * `@workspace/ai` deliberately does not import from the app, so this is the one
 * place the two identity types meet.
 */
export function toAgentActor(actor: Actor): AgentActor {
  return {
    identifier: actor.identifier,
    // Carried through so the agent's own context enforces the cap the merchant
    // set for *this* key, not the one the deployment sets for everybody.
    spendCapPaise: actor.spendCapPaise,
    type: actor.type,
    userId: actor.userId,
  };
}
