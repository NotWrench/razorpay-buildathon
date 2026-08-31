import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";

/**
 * Model resolution.
 *
 * Every call site goes through `chatModel()` / `fastModel()` /
 * `embeddingModel()`, so which provider answers is decided here and nowhere
 * else.
 *
 * Two providers are supported, selected by `AI_PROVIDER`:
 *
 *   `google`  (default) Gemini, the deployment target.
 *   `ollama`            A local model over Ollama's OpenAI-compatible API.
 *                       Useful when Gemini's free tier is exhausted, and the
 *                       only way to run the agent suite offline.
 *
 * Chat and embeddings are chosen separately on purpose. Ollama does not
 * necessarily have an embedding model pulled, and `products.embedding` is a
 * fixed-width column written by whichever model produced it — mixing two
 * embedding providers in one table would silently poison semantic search,
 * because the vectors would be incomparable rather than merely different.
 */

const DEFAULT_CHAT_MODEL = "gemini-3.6-flash";
const DEFAULT_FAST_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";

const DEFAULT_OLLAMA_URL = "http://localhost:11434/v1";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:3b-instruct";

type Provider = "google" | "ollama";

function chatProvider(): Provider {
  return process.env.AI_PROVIDER === "ollama" ? "ollama" : "google";
}

/**
 * Ollama, through its OpenAI-compatible endpoint.
 *
 * The key is required by the client and ignored by Ollama; a placeholder keeps
 * the SDK happy without implying a credential exists.
 */
function ollama() {
  return createOpenAI({
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    baseURL: process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL,
    name: "ollama",
  });
}

/**
 * The local model, addressed through chat completions.
 *
 * `.chat()` rather than the default: `@ai-sdk/openai` v4 targets OpenAI's
 * Responses API, which Ollama does not implement — without this every call
 * 404s on `/v1/responses`.
 *
 * The model name comes from `OLLAMA_CHAT_MODEL`, not `AI_CHAT_MODEL`. A model
 * name is provider-specific, and an `AI_CHAT_MODEL=gemini-…` left in `.env`
 * would otherwise be sent to Ollama, which fails with a confusing "model not
 * found" for a model nobody asked it to load.
 */
function ollamaChat() {
  return ollama().chat(process.env.OLLAMA_CHAT_MODEL ?? DEFAULT_OLLAMA_MODEL);
}

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
  if (chatProvider() === "ollama") {
    return ollamaChat();
  }

  return google()(process.env.AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL);
}

/** Cheaper model for classification and summarisation side-quests. */
export function fastModel(): LanguageModel {
  if (chatProvider() === "ollama") {
    // One local model serves both roles; there is no cheaper tier to drop to.
    return ollamaChat();
  }

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

/**
 * True when the chat provider can actually be reached.
 *
 * Ollama needs no credential, so on that provider this is simply true — the
 * call fails loudly at request time if the daemon is not running, which is a
 * better signal than pretending the agent is unconfigured.
 */
export function hasModelCredentials(): boolean {
  return chatProvider() === "ollama" || Boolean(googleKey());
}

/**
 * True when embeddings can be produced.
 *
 * Separate from `hasModelCredentials` because semantic search is optional and
 * lexical search is the designed fallback. Running chat locally must not turn
 * a missing embedding provider into a failed search — it should quietly become
 * a lexical one.
 */
export function hasEmbeddingCredentials(): boolean {
  return Boolean(googleKey());
}

/**
 * Which provider is answering chat.
 *
 * Exported so callers can branch on it without re-parsing `AI_PROVIDER`
 * themselves — a second copy of that check is exactly the thing that drifts
 * when the selection rule changes here.
 */
export function chatProviderName(): Provider {
  return chatProvider();
}

/** True when chat is served by a local model, so no rate limit applies. */
export function isLocalChatProvider(): boolean {
  return chatProvider() === "ollama";
}

/** Which provider is answering chat, for logs and verification output. */
export function describeProvider(): string {
  return chatProvider() === "ollama"
    ? `ollama:${process.env.OLLAMA_CHAT_MODEL ?? DEFAULT_OLLAMA_MODEL}`
    : `google:${process.env.AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL}`;
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
