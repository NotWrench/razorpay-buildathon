import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";

/**
 * Model resolution — Google Gemini.
 *
 * Every call site goes through `chatModel()` / `fastModel()` /
 * `embeddingModel()`, so swapping provider stays a one-file change.
 */

const DEFAULT_CHAT_MODEL = "gemini-3.6-flash";
const DEFAULT_FAST_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";

/**
 * Dimensions of `products.embedding`.
 *
 * The column is fixed at 1536 and `gemini-embedding-001` defaults to 3072, so
 * every embedding call must pass `outputDimensionality` — see
 * `embeddingProviderOptions`. Mismatched dimensions fail at insert, not at
 * query time, which is a confusing way to find out.
 */
export const EMBEDDING_DIMENSIONS = 1536;

function googleKey(): string | undefined {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
}

function google() {
  const apiKey = googleKey();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) is required to use the AI agents"
    );
  }

  return createGoogleGenerativeAI({ apiKey });
}

export function chatModel(): LanguageModel {
  return google()(process.env.AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL);
}

/** Cheaper model for classification and summarisation side-quests. */
export function fastModel(): LanguageModel {
  return google()(process.env.AI_FAST_MODEL ?? DEFAULT_FAST_MODEL);
}

export function embeddingModel(): EmbeddingModel {
  return google().textEmbeddingModel(
    process.env.AI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL
  );
}

/** Forces the embedding width to match the `vector(1536)` column. */
export function embeddingProviderOptions() {
  return { google: { outputDimensionality: EMBEDDING_DIMENSIONS } };
}

/** True when a provider credential is present. */
export function hasModelCredentials(): boolean {
  return Boolean(googleKey());
}

/**
 * Secret used to HMAC-sign tool approval requests so a client cannot forge an
 * approval for a money action. Falls back to the Razorpay key secret, which is
 * already required for the app to boot.
 */
export function approvalSigningSecret(): string {
  const secret =
    process.env.AGENT_APPROVAL_SECRET ?? process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw new Error(
      "AGENT_APPROVAL_SECRET (or RAZORPAY_KEY_SECRET) is required to sign tool approvals"
    );
  }

  return secret;
}
