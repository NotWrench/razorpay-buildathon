import { beforeEach, describe, expect, test } from "bun:test";
import {
  cachedEmbedding,
  cacheKey,
  embeddingQuotaExhausted,
  isQuotaError,
  noteEmbeddingFailure,
  rememberEmbedding,
  resetEmbeddingBudget,
} from "../src/embedding-budget";
import { EMBEDDING_DIMENSIONS, toColumnVector } from "../src/provider";

/**
 * The rationing around an embedding provider whose free quota runs out mid-demo.
 *
 * The classification test is the one that matters: opening the breaker on a
 * failure that is *not* a quota failure would hide semantic search for five
 * minutes over a typo in an API key, and nothing would say why.
 */

const TOO_WIDE = /dimensions/;

beforeEach(() => {
  resetEmbeddingBudget();
});

describe("query cache", () => {
  test("keys on the model as well as the text", () => {
    expect(cacheKey("google:a", "gpu")).not.toBe(cacheKey("google:b", "gpu"));
  });

  test("ignores case and surrounding space, which are not different queries", () => {
    expect(cacheKey("m", "  Gaming GPU ")).toBe(cacheKey("m", "gaming gpu"));
  });

  test("returns what was stored, and nothing for what was not", () => {
    rememberEmbedding("m gpu", [1, 2, 3]);

    expect(cachedEmbedding("m gpu")).toEqual([1, 2, 3]);
    expect(cachedEmbedding("m psu")).toBeUndefined();
  });

  test("evicts the least recently used, not the oldest", () => {
    for (let index = 0; index < 500; index += 1) {
      rememberEmbedding(`m ${index}`, [index]);
    }

    // Touch the oldest entry, then push one more in to force an eviction.
    expect(cachedEmbedding("m 0")).toEqual([0]);
    rememberEmbedding("m fresh", [1]);

    expect(cachedEmbedding("m 0")).toEqual([0]);
    expect(cachedEmbedding("m 1")).toBeUndefined();
  });
});

describe("isQuotaError", () => {
  test("recognises the ways a provider says no more", () => {
    expect(isQuotaError({ statusCode: 429 })).toBe(true);
    expect(isQuotaError(new Error("RESOURCE_EXHAUSTED: quota"))).toBe(true);
    expect(isQuotaError({ message: "Too Many Requests" })).toBe(true);
  });

  test("does not mistake a real bug for a budget", () => {
    expect(isQuotaError(new Error("invalid api key"))).toBe(false);
    expect(isQuotaError({ statusCode: 500 })).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});

describe("the breaker", () => {
  test("opens on a quota error and stays shut for anything else", () => {
    expect(embeddingQuotaExhausted()).toBe(false);

    noteEmbeddingFailure(new Error("network unreachable"));
    expect(embeddingQuotaExhausted()).toBe(false);

    noteEmbeddingFailure({ statusCode: 429 });
    expect(embeddingQuotaExhausted()).toBe(true);
  });

  test("reports only the transition, so the warning is logged once", () => {
    expect(noteEmbeddingFailure({ statusCode: 429 })).toBe(true);
    expect(noteEmbeddingFailure({ statusCode: 429 })).toBe(false);
  });
});

describe("toColumnVector", () => {
  test("passes a vector of the column's width through untouched", () => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0.5);

    expect(toColumnVector(vector)).toBe(vector);
  });

  test("pads a narrower vector without changing cosine similarity", () => {
    const a = [3, 4, 0];
    const b = [4, 3, 0];

    const cosine = (x: number[], y: number[]) => {
      const dot = x.reduce(
        (total, value, index) => total + value * (y[index] ?? 0),
        0
      );
      const norm = (v: number[]) =>
        Math.sqrt(v.reduce((total, value) => total + value * value, 0));

      return dot / (norm(x) * norm(y));
    };

    const padded = [toColumnVector(a), toColumnVector(b)] as const;

    expect(padded[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(cosine(padded[0], padded[1])).toBeCloseTo(cosine(a, b), 12);
  });

  test("refuses a vector too wide for the column rather than truncating it", () => {
    expect(() =>
      toColumnVector(new Array<number>(EMBEDDING_DIMENSIONS + 1).fill(0.1))
    ).toThrow(TOO_WIDE);
  });
});
