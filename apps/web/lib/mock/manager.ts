import { MOCK_PRODUCTS_BY_ID } from "./products";
import { MOCK_FINDINGS } from "./reports";
import type { ManagerRange, ManagerSummary, ProductSummary } from "./types";

/**
 * The manager's summary, in two windows.
 *
 * Two, and not one, because the range dropdown has to change something. A
 * control that reorders the same numbers is worse than no control — it teaches
 * the operator that the page is decorative.
 *
 * The three product blocks answer three different questions, so a product can
 * legitimately appear in only one of them: what is selling, what is being
 * looked at and not bought, and what nobody has found at all.
 */

function product(id: string): ProductSummary {
  const found = MOCK_PRODUCTS_BY_ID.get(id);

  if (!found) {
    throw new Error(`The manager summary references an unknown product: ${id}`);
  }

  return found;
}

const RANGES: ManagerRange[] = [
  { id: "aug", label: "1–31 August 2026", previous: "previous 30 days" },
  { id: "jul", label: "1–31 July 2026", previous: "previous 30 days" },
  { id: "week", label: "Last 7 days", previous: "previous 7 days" },
];

const AUGUST: ManagerSummary = {
  dueOrders: 6,
  earningsDeltaPercent: 12.4,
  earningsPaise: 184_650_000,
  findings: MOCK_FINDINGS,
  neverSeen: [
    { listedDaysAgo: 46, product: product("storage-2") },
    { listedDaysAgo: 38, product: product("fan-1") },
    { listedDaysAgo: 31, product: product("cooler-1") },
  ],
  newOrders: 14,
  range: RANGES[0] as ManagerRange,
  seenNotBought: [
    { product: product("monitor-1"), sold: 3, views: 412 },
    { product: product("gpu-4"), sold: 2, views: 388 },
    { product: product("case-2"), sold: 4, views: 240 },
  ],
  sellingWell: [
    { product: product("gpu-1"), trend: [8, 11, 9, 14, 17, 22], units: 22 },
    { product: product("cpu-1"), trend: [12, 10, 13, 12, 15, 18], units: 18 },
    { product: product("ram-1"), trend: [6, 9, 8, 11, 10, 13], units: 13 },
  ],
};

const JULY: ManagerSummary = {
  dueOrders: 4,
  earningsDeltaPercent: -3.1,
  earningsPaise: 164_280_000,
  findings: MOCK_FINDINGS.slice(1),
  neverSeen: [
    { listedDaysAgo: 15, product: product("storage-2") },
    { listedDaysAgo: 7, product: product("fan-1") },
  ],
  newOrders: 11,
  range: RANGES[1] as ManagerRange,
  seenNotBought: [
    { product: product("monitor-1"), sold: 5, views: 356 },
    { product: product("case-2"), sold: 6, views: 201 },
    { product: product("peripheral-2"), sold: 9, views: 188 },
  ],
  sellingWell: [
    { product: product("cpu-1"), trend: [9, 12, 14, 11, 16, 19], units: 19 },
    { product: product("gpu-1"), trend: [14, 12, 11, 13, 12, 15], units: 15 },
    { product: product("psu-1"), trend: [4, 6, 7, 6, 9, 11], units: 11 },
  ],
};

/**
 * A quiet week, and the one that proves the findings block is honest: there is
 * nothing worth acting on in it, so it says so rather than inventing a third
 * thing to worry about.
 */
const WEEK: ManagerSummary = {
  dueOrders: 2,
  earningsDeltaPercent: 4.8,
  earningsPaise: 41_120_000,
  findings: [],
  neverSeen: [{ listedDaysAgo: 3, product: product("fan-1") }],
  newOrders: 5,
  range: RANGES[2] as ManagerRange,
  seenNotBought: [
    { product: product("monitor-1"), sold: 1, views: 96 },
    { product: product("gpu-4"), sold: 0, views: 74 },
  ],
  sellingWell: [
    { product: product("gpu-1"), trend: [2, 3, 3, 4, 5, 6], units: 6 },
    { product: product("cpu-1"), trend: [3, 2, 4, 3, 4, 5], units: 5 },
  ],
};

const BY_RANGE: Record<string, ManagerSummary> = {
  aug: AUGUST,
  jul: JULY,
  week: WEEK,
};

export const MANAGER_RANGES = RANGES;

export function managerSummaryFor(rangeId?: string): ManagerSummary {
  return BY_RANGE[rangeId ?? "aug"] ?? AUGUST;
}
