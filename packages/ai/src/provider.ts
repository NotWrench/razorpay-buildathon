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
 * Three providers are supported, selected by `AI_PROVIDER`:
 *
 *   `google`  (default) Gemini, the deployment target.
 *   `nvidia`            A hosted open model through NVIDIA NIM's
 *                       OpenAI-compatible API. This is what the agent suite
 *                       runs on: Gemini's free tier is 20 requests a day and
 *                       one suite run is roughly forty.
 *   `ollama`            A local model over Ollama's OpenAI-compatible API.
 *                       The offline option, and viable only on a machine that
 *                       can hold the whole prompt in VRAM — see below.
 *
 * Chat and embeddings are chosen separately, by `AI_EMBEDDING_PROVIDER` — see
 * `embeddingProvider` below. Ollama does not necessarily have an embedding
 * model pulled, the two are rate-limited apart, and `products.embedding` is a
 * fixed-width column written by whichever model produced it: mixing two
 * embedding providers in one table would silently poison semantic search,
 * because the vectors would be incomparable rather than merely different.
 * `embeddingModelId` is what turns that from a silent failure into a re-embed.
 */

const DEFAULT_CHAT_MODEL = "gemini-3.6-flash";
const DEFAULT_FAST_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";

const DEFAULT_OLLAMA_URL = "http://localhost:11434/v1";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:3b-instruct";
const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";

const DEFAULT_NVIDIA_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_MODEL = "openai/gpt-oss-20b";

type Provider = "google" | "nvidia" | "ollama";

function chatProvider(): Provider {
  if (process.env.AI_PROVIDER === "ollama") {
    return "ollama";
  }

  if (process.env.AI_PROVIDER === "nvidia") {
    return "nvidia";
  }

  return "google";
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
 *
 * Context length is the trap here, and it fails silently. The storefront
 * instructions plus 25 tool schemas are roughly 8k tokens before the
 * conversation starts, and Ollama defaults every model to a 4096-token
 * context — so the prompt is quietly truncated and the model loops on one
 * tool or emits malformed arguments, which reads as "the small model is not
 * capable" rather than "it never saw the tools". `num_ctx` cannot be raised
 * over the OpenAI-compatible endpoint: the `options` field is ignored there.
 * Raise it on the server with `OLLAMA_CONTEXT_LENGTH`, or bake it into a
 * derived model with a Modelfile `PARAMETER num_ctx 16384`.
 *
 * Which leaves VRAM. A 3B at 16k context is ~2.9GB and will not fit a 4GB card
 * alongside a desktop; once it spills to CPU, prompt processing of an 8k
 * prompt takes minutes per step and a single scenario outruns the HTTP
 * timeout. Ollama is the offline option, not the fast one.
 */
function ollamaChat() {
  return ollama().chat(process.env.OLLAMA_CHAT_MODEL ?? DEFAULT_OLLAMA_MODEL);
}

/**
 * NVIDIA NIM, through its OpenAI-compatible endpoint.
 *
 * `.chat()` for the same reason as Ollama: `@ai-sdk/openai` v4 targets
 * OpenAI's Responses API, which NIM does not implement.
 *
 * The model name comes from `NVIDIA_CHAT_MODEL` rather than `AI_CHAT_MODEL`,
 * so a `gemini-…` left in `.env` is not sent to a provider that has never
 * heard of it.
 *
 * The default is `openai/gpt-oss-20b`, and the size is the whole point. NIM
 * serves the free tier by queueing, and the queue is where the 120b sits: with
 * one tool and a two-line prompt it took 39 seconds to reach its first token,
 * against 1.2 seconds for the 20b on the same key and the same payload. A real
 * storefront turn — eight thousand prompt tokens, 25 tool schemas, a dozen
 * steps — never arrived at all, which is not a slow agent but an agent that
 * appears to have hung.
 *
 * The 20b was the reason to prefer the larger model in the first place, so the
 * trade was measured rather than assumed: it completes the full storefront
 * turn — getRequirements, captureRequirements, searchProducts,
 * recommendProducts, quoteOrder — with well-formed calls against all 25 tools,
 * in under a minute end to end.
 *
 * NIM does not serve any Qwen model, and several models it does serve 500 or
 * ignore the `tools` parameter outright, so this list is shorter than it looks.
 * If the 120b stops queueing it is a better model; measure the time to first
 * token before switching back, because that is the number that decides whether
 * this is usable, not the benchmark scores.
 */
function nvidiaChat() {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is required when AI_PROVIDER=nvidia");
  }

  return createOpenAI({
    apiKey,
    baseURL: process.env.NVIDIA_BASE_URL ?? DEFAULT_NVIDIA_URL,
    name: "nvidia",
  }).chat(process.env.NVIDIA_CHAT_MODEL ?? DEFAULT_NVIDIA_MODEL);
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

/**
 * Widens a vector to the column's width by padding it with zeros.
 *
 * `products.embedding` is `vector(1536)` and pgvector will not index anything
 * wider (HNSW stops at 2000), so a provider is usable here only if it returns
 * at most that. Padding with zeros is exact rather than lossy: the dot product
 * and both norms are unchanged, so cosine similarity between two padded
 * vectors equals the similarity between the originals. That is what lets a
 * 768-dimension local model share a column defined for a 1536-dimension hosted
 * one — as long as every row in the column came from the same model, which is
 * what `embedding_model` enforces.
 */
export function toColumnVector(embedding: number[]): number[] {
  if (embedding.length === EMBEDDING_DIMENSIONS) {
    return embedding;
  }

  if (embedding.length > EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model returned ${embedding.length} dimensions, more than the ${EMBEDDING_DIMENSIONS}-wide products.embedding column. Truncating an embedding that was not trained to be truncated would silently degrade search — use a model of ${EMBEDDING_DIMENSIONS} dimensions or fewer.`
    );
  }

  return [
    ...embedding,
    ...new Array<number>(EMBEDDING_DIMENSIONS - embedding.length).fill(0),
  ];
}

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
  switch (chatProvider()) {
    case "ollama":
      return ollamaChat();
    case "nvidia":
      return nvidiaChat();
    default:
      return google()(process.env.AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL);
  }
}

/** Cheaper model for classification and summarisation side-quests. */
export function fastModel(): LanguageModel {
  switch (chatProvider()) {
    // One model serves both roles off Gemini; neither alternative provider is
    // billed per tier, so there is nothing cheaper to drop to.
    case "ollama":
      return ollamaChat();
    case "nvidia":
      return nvidiaChat();
    default:
      return google()(process.env.AI_FAST_MODEL ?? DEFAULT_FAST_MODEL);
  }
}

/**
 * Which provider produces embeddings, selected by `AI_EMBEDDING_PROVIDER`.
 *
 * Deliberately separate from `AI_PROVIDER`: chat and embeddings are billed and
 * rate-limited apart, and Gemini's free embedding quota is the tightest budget
 * in this stack — a handful of searches can exhaust it. Pointing embeddings at
 * a local Ollama model removes the quota entirely while chat stays on a hosted
 * provider, which is the combination this project actually wants on a demo day.
 *
 * NVIDIA NIM is not offered here even though it serves chat. Its embedding
 * models return 2048 dimensions with no way to ask for fewer (`dimensions` is
 * rejected with "must be one of 2048"), and pgvector's HNSW index tops out at
 * 2000 — so a NIM vector cannot be indexed in this schema at all. Truncating
 * an embedding that was not trained for it is worse than not offering it.
 */
type EmbeddingProvider = "google" | "ollama";

function embeddingProvider(): EmbeddingProvider {
  return process.env.AI_EMBEDDING_PROVIDER === "ollama" ? "ollama" : "google";
}

function embeddingModelName(): string {
  return embeddingProvider() === "ollama"
    ? (process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_OLLAMA_EMBEDDING_MODEL)
    : (process.env.AI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL);
}

export function embeddingModel(): EmbeddingModel {
  if (embeddingProvider() === "ollama") {
    return ollama().textEmbeddingModel(embeddingModelName());
  }

  return google().textEmbeddingModel(embeddingModelName());
}

/**
 * What an embedding is for, which changes the vector the model returns.
 *
 * Gemini embeds a question and the document that answers it into different
 * regions unless it is told which is which; `RETRIEVAL_QUERY` against
 * `RETRIEVAL_DOCUMENT` is what makes a good match stand out from the catalog's
 * background similarity. That margin is exactly what `catalog.ts` thresholds
 * on, so the task type is not a tuning knob — the search's honesty depends on
 * it, and a query and a product must never be embedded with the same one.
 */
export type EmbeddingTask = "document" | "query";

/**
 * Forces the embedding width to match the `vector(1536)` column, and tells the
 * model whether it is embedding a question or a product.
 *
 * Ollama's OpenAI-compatible endpoint takes neither option: its models emit a
 * fixed width (which `embeddings.ts` zero-pads up to the column's) and have no
 * notion of a task type.
 */
export function embeddingProviderOptions(
  task: EmbeddingTask = "query"
): Record<string, Record<string, number | string>> {
  if (embeddingProvider() === "ollama") {
    return {};
  }

  return {
    google: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType: task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
    },
  };
}

/**
 * The identity written to `products.embedding_model`.
 *
 * The trailing regime marker is part of the identity because task-typed
 * vectors are not comparable with the untyped ones this project wrote before
 * them — same provider, same model, same width, different space. Bumping it is
 * how a change to `embeddingProviderOptions` invalidates the stored vectors
 * instead of quietly corrupting search results.
 */
export function embeddingModelId(): string {
  return `${embeddingProvider()}:${embeddingModelName()}:${EMBEDDING_DIMENSIONS}:retrieval-v1`;
}

/**
 * True when the chat provider can actually be reached.
 *
 * Ollama needs no credential, so on that provider this is simply true — the
 * call fails loudly at request time if the daemon is not running, which is a
 * better signal than pretending the agent is unconfigured.
 */
export function hasModelCredentials(): boolean {
  switch (chatProvider()) {
    case "ollama":
      return true;
    case "nvidia":
      return Boolean(process.env.NVIDIA_API_KEY);
    default:
      return Boolean(googleKey());
  }
}

/** Names the credential the configured chat provider is missing. */
export function missingCredentialHint(): string {
  return chatProvider() === "nvidia"
    ? "NVIDIA_API_KEY is not set."
    : "GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) is not set.";
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
  // Ollama needs no credential, for the same reason it needs none for chat:
  // a request to a daemon that is not running should fail loudly rather than
  // be reported as "embeddings are not configured".
  return embeddingProvider() === "ollama" || Boolean(googleKey());
}

/** Which provider is producing embeddings, for logs and verification output. */
export function describeEmbeddingProvider(): string {
  return embeddingModelId();
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

/**
 * How long a batch caller should wait between requests, in milliseconds.
 *
 * Only Gemini needs this: its free tier allows 5 requests per minute and every
 * agent step is one request, so the agent suite would otherwise fail on quota
 * rather than on behaviour. A local model has no quota at all, and NIM's
 * per-minute allowance is far above what one scenario issues.
 *
 * Returned from here rather than decided by each caller, so the rule lives
 * next to the provider selection it depends on.
 */
export function chatPaceMs(): number {
  return chatProvider() === "google" ? 65_000 : 0;
}

/** Which provider is answering chat, for logs and verification output. */
export function describeProvider(): string {
  switch (chatProvider()) {
    case "ollama":
      return `ollama:${process.env.OLLAMA_CHAT_MODEL ?? DEFAULT_OLLAMA_MODEL}`;
    case "nvidia":
      return `nvidia:${process.env.NVIDIA_CHAT_MODEL ?? DEFAULT_NVIDIA_MODEL}`;
    default:
      return `google:${process.env.AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL}`;
  }
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
