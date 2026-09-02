import { MOCK_PRODUCTS, MOCK_PRODUCTS_BY_ID } from "./products";
import type {
  ManagerOrder,
  ManagerProduct,
  ProductSummary,
  RestockDraft,
  RestockRow,
  StoreSettings,
} from "./types";

/**
 * What the manager's four editing surfaces hold.
 *
 * Deliberately dull: these screens are for changing things, and the interesting
 * numbers all live on the summary. Stock and status are derived from the
 * product id so the same product is always in the same state — a screenshot
 * taken twice matches, and "low" always means the same rows.
 */

function product(id: string): ProductSummary {
  const found = MOCK_PRODUCTS_BY_ID.get(id);

  if (!found) {
    throw new Error(`A manager table references an unknown product: ${id}`);
  }

  return found;
}

/** Stable pseudo-stock: the same product always has the same count. */
function stockFor(id: string): number {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return seed % 37;
}

export const MANAGER_PRODUCTS: ManagerProduct[] = MOCK_PRODUCTS.map(
  (entry, index) => ({
    lowAt: 6,
    product: entry,
    /* Two of the twenty-four are unpublished, which is what a real catalogue
       looks like — everything Live would make the column pointless. */
    status: index === 5 || index === 17 ? "draft" : "live",
    stock: stockFor(entry.id),
  })
);

export const MANAGER_ORDERS: ManagerOrder[] = [
  {
    customer: "Aarav Menon",
    id: "NX-5012",
    itemCount: 3,
    lines: [
      {
        name: "GeForce RTX 5080 Founders Edition",
        pricePaise: 10_990_000,
        quantity: 1,
      },
      { name: "RM850x SHIFT", pricePaise: 1_460_000, quantity: 1 },
      { name: "990 EVO Plus NVMe", pricePaise: 1_870_000, quantity: 1 },
    ],
    placedOn: "31 Aug 2026",
    state: "new",
    totalPaise: 14_320_000,
  },
  {
    customer: "Priya Nair",
    id: "NX-5008",
    itemCount: 1,
    lines: [{ name: "Ryzen 7 9800X3D", pricePaise: 4_690_000, quantity: 1 }],
    placedOn: "30 Aug 2026",
    state: "new",
    totalPaise: 4_690_000,
  },
  {
    customer: "Rohan Iyer",
    id: "NX-4996",
    itemCount: 2,
    lines: [
      { name: "North XL", pricePaise: 1_690_000, quantity: 1 },
      { name: "NF-A14 PWM (3-pack)", pricePaise: 620_000, quantity: 1 },
    ],
    placedOn: "29 Aug 2026",
    state: "due",
    totalPaise: 2_310_000,
  },
  {
    customer: "Sana Kulkarni",
    id: "NX-4981",
    itemCount: 4,
    lines: [
      { name: "Trident Z5 Neo 64GB", pricePaise: 2_190_000, quantity: 1 },
      { name: "TUF Gaming B850-Plus WiFi", pricePaise: 2_140_000, quantity: 1 },
      { name: "Liquid Freezer III 360", pricePaise: 1_040_000, quantity: 1 },
      { name: "Vertex PX-1200", pricePaise: 2_340_000, quantity: 1 },
    ],
    placedOn: "27 Aug 2026",
    state: "fulfilled",
    totalPaise: 7_710_000,
  },
  {
    customer: "Devika Rao",
    id: "NX-4970",
    itemCount: 1,
    lines: [{ name: "UltraGear 27GX790A", pricePaise: 7_890_000, quantity: 1 }],
    placedOn: "25 Aug 2026",
    state: "cancelled",
    totalPaise: 7_890_000,
  },
  {
    customer: "Imran Sheikh",
    id: "NX-4962",
    itemCount: 2,
    lines: [
      { name: "O11 Vision Compact", pricePaise: 1_420_000, quantity: 1 },
      { name: "NH-D15 G2", pricePaise: 1_180_000, quantity: 1 },
    ],
    placedOn: "24 Aug 2026",
    state: "refunded",
    totalPaise: 2_600_000,
  },
  {
    customer: "Meera Joseph",
    id: "NX-4955",
    itemCount: 5,
    lines: [
      { name: "PRIME GeForce RTX 5070", pricePaise: 6_840_000, quantity: 1 },
      { name: "Ryzen 5 9600X", pricePaise: 2_480_000, quantity: 1 },
      { name: "Vengeance RGB DDR5", pricePaise: 1_180_000, quantity: 1 },
      { name: "990 EVO Plus NVMe", pricePaise: 1_870_000, quantity: 1 },
      { name: "RM850x SHIFT", pricePaise: 1_460_000, quantity: 1 },
    ],
    placedOn: "22 Aug 2026",
    state: "fulfilled",
    totalPaise: 13_830_000,
  },
];

export const RESTOCK_ROWS: RestockRow[] = [
  {
    id: "restock-1",
    inStock: 3,
    product: product("gpu-3"),
    suggested: 20,
    threshold: 10,
  },
  {
    id: "restock-2",
    inStock: 4,
    product: product("cpu-1"),
    suggested: 12,
    threshold: 8,
  },
  {
    id: "restock-3",
    inStock: 2,
    product: product("psu-1"),
    suggested: 15,
    threshold: 6,
  },
  {
    id: "restock-4",
    inStock: 5,
    product: product("ram-1"),
    suggested: 24,
    threshold: 12,
  },
  {
    id: "restock-5",
    inStock: 1,
    product: product("cooler-2"),
    suggested: 10,
    threshold: 5,
  },
];

export const RESTOCK_DRAFTS: RestockDraft[] = [
  {
    id: "draft-1",
    product: product("gpu-3"),
    provenance:
      "Drafted from the 1–31 August summary: 14 sold, 3 on hand, 9 day lead time.",
    quantity: 20,
  },
];

export const STORE_SETTINGS: StoreSettings = {
  currency: "INR",
  name: "Nexus Systems",
  razorpayKeyId: "rzp_live_••••••••4F1Z",
  slug: "nexus-pc",
  team: [
    {
      email: "kavin@nexus.dev",
      id: "team-1",
      name: "Kavin Raj",
      role: "Owner",
    },
    {
      email: "asha@nexus.dev",
      id: "team-2",
      name: "Asha Pillai",
      role: "Manager",
    },
    {
      email: "vikram@nexus.dev",
      id: "team-3",
      name: "Vikram Bose",
      role: "Support",
    },
  ],
};
