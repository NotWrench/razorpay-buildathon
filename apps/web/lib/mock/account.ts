import type { Account } from "./types";

/**
 * One signed-in shopper.
 *
 * The figures, the orders and the builds are all consistent with each other:
 * twelve orders totalling ₹4,86,200, of which the four most recent are listed
 * here, and five saved builds of which three are shown. A profile whose
 * headline number disagrees with the table under it is the fastest way to make
 * every other number on the page look invented.
 */
export const MOCK_ACCOUNT: Account = {
  addresses: [
    {
      id: "addr-1",
      label: "Home",
      lines: ["Flat 12B, Sunder Residency", "Indiranagar, Bengaluru 560038"],
      primary: true,
    },
    {
      id: "addr-2",
      label: "Office",
      lines: ["4th Floor, Prestige Atrium", "Richmond Road, Bengaluru 560025"],
      primary: false,
    },
  ],
  builds: [
    {
      id: "build-1",
      name: "1440p main rig",
      partCount: 8,
      totalPaise: 18_700_000,
    },
    {
      id: "build-2",
      name: "Editing box",
      partCount: 9,
      totalPaise: 26_400_000,
    },
    {
      id: "build-3",
      name: "Living room small form",
      partCount: 7,
      totalPaise: 9_850_000,
    },
  ],
  email: "kavin@nexus.dev",
  figures: {
    builds: 5,
    conversations: 38,
    orders: 12,
    totalSpentPaise: 48_620_000,
  },
  memberSince: "January 2026",
  name: "Kavin Raj",
  orders: [
    {
      id: "NX-4821",
      itemCount: 3,
      lines: [
        {
          name: "GeForce RTX 5080 Founders Edition",
          pricePaise: 10_990_000,
          quantity: 1,
        },
        { name: "Liquid Freezer III 360", pricePaise: 1_040_000, quantity: 1 },
        { name: "990 EVO Plus NVMe 2TB", pricePaise: 1_870_000, quantity: 1 },
      ],
      placedOn: "18 Aug 2026",
      state: "delivered",
      totalPaise: 13_900_000,
    },
    {
      id: "NX-4693",
      itemCount: 1,
      lines: [{ name: "RM850x SHIFT", pricePaise: 1_460_000, quantity: 1 }],
      placedOn: "02 Aug 2026",
      state: "shipped",
      totalPaise: 1_460_000,
    },
    {
      id: "NX-4550",
      itemCount: 2,
      lines: [
        { name: "Vengeance RGB DDR5 32GB", pricePaise: 1_180_000, quantity: 1 },
        {
          name: "TUF Gaming B850-Plus WiFi",
          pricePaise: 2_140_000,
          quantity: 1,
        },
      ],
      placedOn: "21 Jul 2026",
      state: "cancelled",
      totalPaise: 3_320_000,
    },
    {
      id: "NX-4412",
      itemCount: 4,
      lines: [
        { name: "Ryzen 7 9800X3D", pricePaise: 4_690_000, quantity: 1 },
        { name: "North XL", pricePaise: 1_690_000, quantity: 1 },
        { name: "Trident Z5 Neo 64GB", pricePaise: 2_190_000, quantity: 1 },
        { name: "Vertex PX-1200", pricePaise: 2_340_000, quantity: 1 },
      ],
      placedOn: "09 Jul 2026",
      state: "delivered",
      totalPaise: 10_910_000,
    },
  ],
};
