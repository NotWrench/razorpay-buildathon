/**
 * The client half of the agent protocol.
 *
 * Everything here runs in the browser, so nothing in this directory may reach
 * for the database, the payments client or a credential — importing
 * `@workspace/ai` proper from a client component would drag all three into the
 * bundle. That constraint is the reason this is a separate entry point rather
 * than a corner of the main one.
 */

export { lastAssistantTurnIsAnswered } from "./resume";
