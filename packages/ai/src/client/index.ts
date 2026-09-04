/**
 * The client half of the agent protocol.
 *
 * Everything here runs in the browser, so nothing in this directory may reach
 * for the database, the payments client or a credential — importing
 * `@workspace/ai` proper from a client component would drag all three into the
 * bundle. That constraint is the reason this is a separate entry point rather
 * than a corner of the main one.
 */

/*
 * The slider's default step. Shared rather than reimplemented because the
 * browser draws the question from the streaming tool input, before the
 * schema that fills this in has run — two formulas would mean the slider
 * jumped the moment the turn validated.
 */
/*
 * The browser needs the name repair too: the control tokens are already on
 * the name when the part is created, so a repaired call still draws under
 * the mangled type unless this is applied.
 */
export { cleanToolPartType } from "../agents/repair";
export { stepFor } from "../tools/ask-buyer-schema";
export { lastAssistantTurnIsAnswered } from "./resume";
