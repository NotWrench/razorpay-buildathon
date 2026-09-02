/**
 * How a buyer's words become something the catalog can be searched with.
 *
 * Kept apart from `catalog.ts` because none of it touches the database: this
 * is the layer that decides what a query is *about*, and it is the only part
 * of search that can be tested without a Postgres running.
 */

const WHITESPACE = /\s+/;
const PLURAL_IES = /ies$/;
const PLURAL_S = /([^s])s$/;
const NON_ALPHANUMERIC = /[^a-z0-9]/gi;

/**
 * Words long enough to survive the length filter but carrying no signal about
 * a product. Without this, "a graphics card **for** 1440p gaming" matches every
 * description containing "performance", and the query's real terms are
 * outvoted by its filler.
 */
const STOP_WORDS = new Set([
  "and",
  "any",
  "are",
  "best",
  "but",
  "can",
  "for",
  "get",
  "good",
  "has",
  "have",
  "its",
  "need",
  "not",
  "one",
  "that",
  "the",
  "them",
  "they",
  "this",
  "under",
  "want",
  "what",
  "which",
  "with",
  "you",
  "your",
]);

/**
 * What buyers call a category, mapped to what the catalogue calls it.
 *
 * `products.category` holds trade abbreviations — `gpu`, `psu`, `ram` — and
 * nobody shopping types those. Semantic search bridges the gap on its own;
 * lexical search cannot, so "a graphics card for 1440p gaming" matched every
 * motherboard with "Gaming" in its name and not one GPU. Recognising the
 * phrase and searching the category it names is the whole fix.
 *
 * Longest phrases first: "hard drive" must be tested before "drive".
 */
const CATEGORY_SYNONYMS: [phrase: string, category: string][] = [
  ["graphics card", "gpu"],
  ["video card", "gpu"],
  ["power supply", "psu"],
  ["hard drive", "storage"],
  ["solid state", "storage"],
  ["cpu cooler", "cooler"],
  ["heat sink", "cooler"],
  ["mother board", "motherboard"],
  ["processor", "cpu"],
  ["memory", "ram"],
  ["ssd", "storage"],
  ["hdd", "storage"],
  ["nvme", "storage"],
  ["screen", "monitor"],
  ["display", "monitor"],
  ["keyboard", "peripheral"],
  ["mouse", "peripheral"],
  ["headset", "peripheral"],
];

/**
 * Resolves whatever the model called a category to what the column stores.
 *
 * The `category` filter is an equality match, so an unrecognised value returns
 * nothing at all rather than a worse ranking. A model asked for "a graphics
 * card" naturally filters on `"Graphics Card"`, matches zero rows against
 * `gpu`, and — having been told to search before recommending — searches again
 * and again until it runs out of steps. Mapping the label is what stops that.
 *
 * An unrecognised value is passed through untouched: a merchant whose
 * categories are not the ones below must still be able to filter on their own.
 */
export function canonicalCategory(category: string): string {
  const needle = category.trim().toLowerCase();

  return categoryNamed(needle) ?? needle;
}

/**
 * The category a phrase names, if it names one.
 *
 * Enough de-pluralising for the words in the synonym list, and no more.
 * Buyers type "graphics cards" and "power supplies"; a real stemmer would be a
 * large dependency for a lookup whose failure mode is only ever a slightly
 * worse ranking.
 */
function categoryNamed(phrase: string): string | undefined {
  const candidates = [
    phrase,
    phrase.replace(PLURAL_IES, "y"),
    phrase.replace(PLURAL_S, "$1"),
  ];

  const match = CATEGORY_SYNONYMS.find(
    ([synonym, canonical]) =>
      candidates.includes(synonym) || candidates.includes(canonical)
  );

  return match?.[1];
}

/**
 * The words worth searching for, in the order they matter.
 *
 * Exported for the tests, which are the only place the term list can be
 * checked without a database.
 */
export function queryTerms(query: string): string[] {
  const lowered = query.toLowerCase();

  const spoken = lowered
    .split(WHITESPACE)
    .map((term) => term.replace(NON_ALPHANUMERIC, ""))
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  // A named category is the strongest signal in the query, so it leads the
  // terms — the six-term cap must never drop it in favour of filler.
  //
  // Both spellings of "named" are needed. A multi-word synonym ("graphics
  // card") only appears in the raw query, while a single word ("peripherals",
  // "monitors") only resolves once it has been split out and de-pluralised —
  // and the plain plural of a category is exactly the query the embedding
  // model handles worst, because a word like "peripherals" names a shelf
  // rather than a thing. Lexical matching is the better answer there, so it
  // must be able to recognise it.
  const phrases = CATEGORY_SYNONYMS.filter(([phrase]) =>
    lowered.includes(phrase)
  ).map(([, category]) => category);

  const named = [
    ...phrases,
    ...spoken.map(categoryNamed).filter((category) => category !== undefined),
  ];

  return [...new Set([...named, ...spoken])].slice(0, 6);
}

/**
 * True when the query is nothing but the name of a category.
 *
 * "gpu", "graphics card", "power supply" — a lexical search on these is exact,
 * so embedding them buys nothing and spends a request against a quota that is
 * the scarcest thing in this stack. Anything with a qualifier in it ("a quiet
 * power supply") still goes to the embedding model, because that is where the
 * qualifier is understood.
 */
export function namesOnlyACategory(query: string): boolean {
  return categoryNamed(query.trim().toLowerCase()) !== undefined;
}
