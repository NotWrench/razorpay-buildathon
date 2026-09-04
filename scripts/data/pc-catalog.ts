import type { CategorySlug, PciePowerConnector } from "@workspace/db";

/**
 * The demo store's catalog: a hand-curated PC component range.
 *
 * Curated rather than scraped, because the compatibility engine is only ever
 * as good as its specs. Sixty parts whose sockets, form factors, clearances
 * and wattages are all internally consistent are worth far more than a large
 * catalog full of plausible-looking noise — a wrong spec produces a confident
 * wrong answer, which is the one failure §4 is written to prevent.
 *
 * The range is deliberately trapped. Every rule the engine implements has at
 * least one pair of products in here that fails it, so the failure paths can
 * be demonstrated and not merely asserted:
 *
 *   socket           Hyper 212 Black (no AM5) against any AM5 processor
 *   RAM generation   Vengeance LPX DDR4 against any DDR5 board
 *   board/case       B650 Tomahawk (ATX) in the NR200P (ITX)
 *   GPU clearance    RTX 4080 SUPER at 358mm in the ICE-200TG at 300mm
 *   cooler clearance NH-D15 at 165mm in the NR200P at 155mm
 *   PSU headroom     Antec CSK 450 under a 7900X and a 4070 Ti SUPER
 *   PSU connectors   Antec CSK 450 (one 8-pin) under a three-connector card
 *   insufficient     Arc A750, imported, with no published length or connectors
 */

/** Spec fields as the seed states them; everything omitted stays null. */
export interface SeedSpec {
  chipset?: string;
  extra?: Record<string, unknown>;
  formFactor?: string;
  heightMm?: number;
  lengthMm?: number;
  m2Slots?: number;
  maxCoolerHeightMm?: number;
  maxGpuLengthMm?: number;
  /**
   * Capacity in GB: a memory kit's total, a board's maximum, a card's VRAM.
   * Drive capacity lives in `extra.capacityGb` — it is not memory and the
   * engine never compares the two.
   */
  memoryCapacityGb?: number;
  /**
   * On a board, the DIMM slots available. On a memory kit, the slots the kit
   * occupies — so `motherboard_ram_slots` is one comparison in one column
   * rather than a parse of the product name.
   */
  memorySlots?: number;
  memorySpeedMhz?: number;
  memoryType?: string;
  pciePowerConnectors?: PciePowerConnector[];
  psuWattage?: number;
  recommendedPsuWatts?: number;
  sataPorts?: number;
  /**
   * One socket for a processor or a board. A cooler mounts on several, so it
   * lists them comma-separated — the rule splits and looks for membership.
   */
  socket?: string;
  storageInterface?: string;
  tdpWatts?: number;
  widthMm?: number;
}

export interface SeedInventory {
  lastRestockedDaysAgo?: number;
  lowStockThreshold?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  supplierLeadTimeDays?: number;
}

export interface SeedProduct {
  /** Display-only detail. The engine reads `specs`, never this. */
  attributes?: Record<string, unknown>;
  brand: string;
  categorySlug: CategorySlug;
  description: string;
  /**
   * A photograph of the part, hotlinked from the retail listing it was taken
   * from. Null for the handful of parts that no longer have a listing
   * anywhere — a missing photo has to reach the storefront as an absent
   * image and not as a broken one.
   */
  imageUrl?: string;
  inventory?: SeedInventory;
  name: string;
  /** Rupees; converted to paise on insert. */
  priceRupees: number;
  sku: string;
  specs?: SeedSpec;
  stock: number;
}

export const PC_CATALOG: SeedProduct[] = [
  // ------------------------------------------------------------------ CPUs
  {
    attributes: { cores: "6C/12T", generation: "Zen 4", igpu: true },
    brand: "AMD",
    categorySlug: "cpu",
    description:
      "Six-core Zen 4 processor on AM5, 65W, with a bundled cooler and basic integrated graphics. The sensible centre of a 1440p gaming build.",
    imageUrl: "https://m.media-amazon.com/images/I/61h39mKsSBL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 9,
      lowStockThreshold: 6,
      reorderPoint: 8,
      reorderQuantity: 20,
      supplierLeadTimeDays: 7,
    },
    name: "AMD Ryzen 5 7600",
    priceRupees: 17_499,
    sku: "CPU-AMD-R5-7600",
    specs: {
      memoryType: "DDR5",
      socket: "AM5",
      tdpWatts: 65,
    },
    stock: 3,
  },
  {
    attributes: { cache: "96MB 3D V-Cache", cores: "8C/16T", igpu: true },
    brand: "AMD",
    categorySlug: "cpu",
    description:
      "Eight-core AM5 processor with stacked 3D V-Cache. The fastest gaming CPU at its power draw, and unremarkable at everything else.",
    imageUrl: "https://m.media-amazon.com/images/I/51HqC0rU9HL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 10,
    },
    name: "AMD Ryzen 7 7800X3D",
    priceRupees: 34_999,
    sku: "CPU-AMD-R7-7800X3D",
    specs: {
      memoryType: "DDR5",
      socket: "AM5",
      tdpWatts: 120,
    },
    stock: 8,
  },
  {
    attributes: { cores: "12C/24T", igpu: true },
    brand: "AMD",
    categorySlug: "cpu",
    description:
      "Twelve-core AM5 processor for rendering, compilation and heavy multitasking. Draws 170W sustained and wants real cooling.",
    imageUrl: "https://m.media-amazon.com/images/I/51OEiWrUtqL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 14,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 10,
    },
    name: "AMD Ryzen 9 7900X",
    priceRupees: 38_999,
    sku: "CPU-AMD-R9-7900X",
    specs: {
      memoryType: "DDR5",
      socket: "AM5",
      tdpWatts: 170,
    },
    stock: 6,
  },
  {
    attributes: { cores: "6C/12T", generation: "Zen 4", igpu: "Radeon 760M" },
    brand: "AMD",
    categorySlug: "cpu",
    description:
      "AM5 processor with integrated Radeon graphics strong enough for 1080p esports without a discrete card. The starting point for a GPU-less build.",
    imageUrl: "https://m.media-amazon.com/images/I/615TPN-DayL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 11,
      lowStockThreshold: 4,
      reorderPoint: 6,
      reorderQuantity: 12,
      supplierLeadTimeDays: 7,
    },
    name: "AMD Ryzen 5 8600G",
    priceRupees: 22_999,
    sku: "CPU-AMD-R5-8600G",
    specs: {
      memoryType: "DDR5",
      socket: "AM5",
      tdpWatts: 65,
    },
    stock: 11,
  },
  {
    attributes: { cores: "6C/12T", generation: "Zen 3", igpu: false },
    brand: "AMD",
    categorySlug: "cpu",
    description:
      "Six-core AM4 processor on the older DDR4 platform. Still the cheapest honest route to 1080p gaming, with no upgrade path beyond AM4.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/09/AMD-Ryzen-5-5600-AM4-Desktop-Processor-6-Cores-12-Threads-100-100000927BOX.jpg",
    inventory: {
      lastRestockedDaysAgo: 25,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 5,
    },
    name: "AMD Ryzen 5 5600",
    priceRupees: 9999,
    sku: "CPU-AMD-R5-5600",
    specs: {
      memoryType: "DDR4",
      socket: "AM4",
      tdpWatts: 65,
    },
    stock: 18,
  },
  {
    attributes: { cores: "10C/16T", igpu: false },
    brand: "Intel",
    categorySlug: "cpu",
    description:
      "Ten-core LGA1700 processor without integrated graphics, so it needs a discrete card. Strong value for mixed gaming and productivity.",
    imageUrl: "https://m.media-amazon.com/images/I/51wQQ9WWa7L._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 8,
      lowStockThreshold: 5,
      reorderPoint: 7,
      reorderQuantity: 18,
      supplierLeadTimeDays: 7,
    },
    name: "Intel Core i5-13400F",
    priceRupees: 18_499,
    sku: "CPU-INT-I5-13400F",
    specs: {
      memoryType: "DDR5",
      socket: "LGA1700",
      tdpWatts: 148,
    },
    stock: 16,
  },
  {
    attributes: { cores: "14C/20T", igpu: "UHD 770", unlocked: true },
    brand: "Intel",
    categorySlug: "cpu",
    description:
      "Unlocked fourteen-core LGA1700 processor. Fast, and hot enough that the cooler choice stops being optional.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Intel-Core-i5-14600K-3.5-GHz-14-Core-LGA-1700-Processor-BX8071514600K-20231025-070657.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 10,
    },
    name: "Intel Core i5-14600K",
    priceRupees: 27_999,
    sku: "CPU-INT-I5-14600K",
    specs: {
      memoryType: "DDR5",
      socket: "LGA1700",
      tdpWatts: 181,
    },
    stock: 9,
  },
  {
    attributes: { cores: "20C/28T", igpu: "UHD 770", unlocked: true },
    brand: "Intel",
    categorySlug: "cpu",
    description:
      "Twenty-core LGA1700 flagship. Peaks at 253W, which drives the cooler and power-supply choice more than any other part in the build.",
    imageUrl: "https://m.media-amazon.com/images/I/61aAAg73uLL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 17,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 12,
    },
    name: "Intel Core i7-14700K",
    priceRupees: 42_999,
    sku: "CPU-INT-I7-14700K",
    specs: {
      memoryType: "DDR5",
      socket: "LGA1700",
      tdpWatts: 253,
    },
    stock: 5,
  },
  {
    attributes: { architecture: "Zen 5 (3D V-Cache)", cores: "8C / 16T", socket: "AM5" },
    brand: "AMD",
    categorySlug: "cpu",
    description:
      "Eight-core Zen 5 gaming powerhouse with 96MB of L3 3D V-Cache and second-generation thermal packaging. Dominates high-framerate competitive gaming.",
    imageUrl: "https://m.media-amazon.com/images/I/51w+z4k24rL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 2,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 15,
      supplierLeadTimeDays: 7,
    },
    name: "AMD Ryzen 7 9800X3D",
    priceRupees: 47_999,
    sku: "CPU-AMD-R7-9800X3D",
    specs: {
      memoryType: "DDR5",
      socket: "AM5",
      tdpWatts: 120,
    },
    stock: 12,
  },
  {
    attributes: { architecture: "Zen 5", cores: "16C / 32T", socket: "AM5" },
    brand: "AMD",
    categorySlug: "cpu",
    description:
      "Sixteen-core flagship Zen 5 processor for high-throughput code compilation, 3D modeling, and workstation workloads on the AM5 platform.",
    imageUrl: "https://m.media-amazon.com/images/I/51rYg-FfMGL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 10,
    },
    name: "AMD Ryzen 9 9950X",
    priceRupees: 58_999,
    sku: "CPU-AMD-R9-9950X",
    specs: {
      memoryType: "DDR5",
      socket: "AM5",
      tdpWatts: 170,
    },
    stock: 6,
  },
  {
    attributes: { architecture: "Zen 5", cores: "8C / 16T", socket: "AM5" },
    brand: "AMD",
    categorySlug: "cpu",
    description:
      "Eight-core Zen 5 desktop processor with an ultra-efficient 65W TDP. Delivers top-tier single-thread speed and high-efficiency gaming performance.",
    imageUrl: "https://m.media-amazon.com/images/I/51rYg-FfMGL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 8,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 12,
      supplierLeadTimeDays: 8,
    },
    name: "AMD Ryzen 7 9700X",
    priceRupees: 32_999,
    sku: "CPU-AMD-R7-9700X",
    specs: {
      memoryType: "DDR5",
      socket: "AM5",
      tdpWatts: 65,
    },
    stock: 15,
  },
  {
    attributes: { architecture: "Arrow Lake-S", cores: "24C (8P + 16E)", socket: "LGA1851" },
    brand: "Intel",
    categorySlug: "cpu",
    description:
      "Twenty-four core flagship Arrow Lake desktop processor on socket LGA1851. Features dedicated NPU for AI workloads and outstanding energy efficiency.",
    imageUrl: "https://m.media-amazon.com/images/I/61M6Xk+xVJL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 14,
    },
    name: "Intel Core Ultra 9 285K",
    priceRupees: 54_999,
    sku: "CPU-INT-CU9-285K",
    specs: {
      memoryType: "DDR5",
      socket: "LGA1851",
      tdpWatts: 250,
    },
    stock: 7,
  },
  {
    attributes: { architecture: "Arrow Lake-S", cores: "20C (8P + 12E)", socket: "LGA1851" },
    brand: "Intel",
    categorySlug: "cpu",
    description:
      "Twenty-core performance processor on LGA1851 with 20 threads, dedicated NPU AI acceleration, and strong single-core gaming speed.",
    imageUrl: "https://m.media-amazon.com/images/I/61M6Xk+xVJL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 10,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 10,
      supplierLeadTimeDays: 12,
    },
    name: "Intel Core Ultra 7 265K",
    priceRupees: 38_999,
    sku: "CPU-INT-CU7-265K",
    specs: {
      memoryType: "DDR5",
      socket: "LGA1851",
      tdpWatts: 250,
    },
    stock: 9,
  },

  // ---------------------------------------------------------- Motherboards
  {
    attributes: { networking: "2.5GbE + Wi-Fi 6E", vrm: "14+2+1" },
    brand: "MSI",
    categorySlug: "motherboard",
    description:
      "Full-size AM5 board with a heavy VRM, three M.2 slots and Wi-Fi 6E. The default choice for an ATX Ryzen build.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/MSI-MAG-B650-Tomahawk-WIFI-Motherboard.png",
    inventory: {
      lastRestockedDaysAgo: 7,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 14,
    },
    name: "MSI MAG B650 Tomahawk WiFi",
    priceRupees: 18_999,
    sku: "MBD-MSI-B650-TMHK",
    specs: {
      chipset: "B650",
      formFactor: "ATX",
      m2Slots: 3,
      memoryCapacityGb: 192,
      memorySlots: 4,
      memorySpeedMhz: 6400,
      memoryType: "DDR5",
      sataPorts: 6,
      socket: "AM5",
    },
    stock: 12,
  },
  {
    attributes: { networking: "2.5GbE", vrm: "12+2" },
    brand: "ASUS",
    categorySlug: "motherboard",
    description:
      "Micro-ATX AM5 board with four DIMM slots and two M.2 slots. Everything a mid-range Ryzen build needs and nothing it does not.",
    imageUrl: "https://m.media-amazon.com/images/I/81W4GFPKkyL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 6,
      reorderPoint: 8,
      reorderQuantity: 20,
      supplierLeadTimeDays: 14,
    },
    name: "ASUS TUF Gaming B650M-PLUS",
    priceRupees: 14_499,
    sku: "MBD-ASUS-B650M-PLUS",
    specs: {
      chipset: "B650",
      formFactor: "mATX",
      m2Slots: 2,
      memoryCapacityGb: 128,
      memorySlots: 4,
      memorySpeedMhz: 6400,
      memoryType: "DDR5",
      sataPorts: 4,
      socket: "AM5",
    },
    stock: 2,
  },
  {
    attributes: { networking: "2.5GbE + Wi-Fi 6E", pcie: "PCIe 5.0 x16" },
    brand: "Gigabyte",
    categorySlug: "motherboard",
    description:
      "High-end AM5 board with PCIe 5.0 graphics and storage, four M.2 slots and enough VRM for a 170W processor at sustained load.",
    imageUrl: "https://m.media-amazon.com/images/I/71ubTinPcOL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 20,
      lowStockThreshold: 3,
      reorderPoint: 3,
      reorderQuantity: 8,
      supplierLeadTimeDays: 18,
    },
    name: "Gigabyte X670E AORUS Elite AX",
    priceRupees: 27_999,
    sku: "MBD-GIGA-X670E-ELITE",
    specs: {
      chipset: "X670E",
      formFactor: "ATX",
      m2Slots: 4,
      memoryCapacityGb: 192,
      memorySlots: 4,
      memorySpeedMhz: 6666,
      memoryType: "DDR5",
      sataPorts: 6,
      socket: "AM5",
    },
    stock: 4,
  },
  {
    attributes: { networking: "2.5GbE + Wi-Fi 6E", vrm: "10+2+1" },
    brand: "ASRock",
    categorySlug: "motherboard",
    description:
      "Mini-ITX AM5 board with two DIMM slots. The only route to a small-form-factor Ryzen build, and the reason a 64GB kit will not fit one.",
    inventory: {
      lastRestockedDaysAgo: 22,
      lowStockThreshold: 2,
      reorderPoint: 3,
      reorderQuantity: 6,
      supplierLeadTimeDays: 21,
    },
    name: "ASRock B650E PG-ITX WiFi",
    priceRupees: 22_999,
    sku: "MBD-ASRK-B650E-ITX",
    specs: {
      chipset: "B650E",
      formFactor: "ITX",
      m2Slots: 2,
      memoryCapacityGb: 96,
      memorySlots: 2,
      memorySpeedMhz: 6600,
      memoryType: "DDR5",
      sataPorts: 4,
      socket: "AM5",
    },
    stock: 3,
  },
  {
    attributes: { networking: "2.5GbE", vrm: "10+3" },
    brand: "MSI",
    categorySlug: "motherboard",
    description:
      "ATX AM4 board on the DDR4 platform. Pairs with the Ryzen 5 5600 for the cheapest complete build in the store.",
    imageUrl: "https://m.media-amazon.com/images/I/81WSM868b8S._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 30,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 10,
    },
    name: "MSI PRO B550-A",
    priceRupees: 11_499,
    sku: "MBD-MSI-B550-A",
    specs: {
      chipset: "B550",
      formFactor: "ATX",
      m2Slots: 2,
      memoryCapacityGb: 128,
      memorySlots: 4,
      memorySpeedMhz: 4400,
      memoryType: "DDR4",
      sataPorts: 6,
      socket: "AM4",
    },
    stock: 14,
  },
  {
    attributes: { networking: "2.5GbE + Wi-Fi 6", vrm: "8+1+1" },
    brand: "MSI",
    categorySlug: "motherboard",
    description:
      "Micro-ATX LGA1700 board with DDR5 and Wi-Fi 6. Sized for a locked Intel processor rather than an overclocked one.",
    imageUrl: "https://m.media-amazon.com/images/I/91FJ2stRN+L._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 12,
    },
    name: "MSI PRO B760M-A WiFi",
    priceRupees: 14_999,
    sku: "MBD-MSI-B760M-A",
    specs: {
      chipset: "B760",
      formFactor: "mATX",
      m2Slots: 2,
      memoryCapacityGb: 128,
      memorySlots: 4,
      memorySpeedMhz: 6800,
      memoryType: "DDR5",
      sataPorts: 4,
      socket: "LGA1700",
    },
    stock: 15,
  },
  {
    attributes: { networking: "2.5GbE + Wi-Fi 6E", vrm: "16+1" },
    brand: "ASUS",
    categorySlug: "motherboard",
    description:
      "ATX LGA1700 board with the VRM and memory tuning an unlocked Core i7 actually needs. Four M.2 slots.",
    imageUrl: "https://m.media-amazon.com/images/I/81rX0VhoStL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 13,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 16,
    },
    name: "ASUS TUF Gaming Z790-PLUS WiFi",
    priceRupees: 24_999,
    sku: "MBD-ASUS-Z790-PLUS",
    specs: {
      chipset: "Z790",
      formFactor: "ATX",
      m2Slots: 4,
      memoryCapacityGb: 128,
      memorySlots: 4,
      memorySpeedMhz: 7800,
      memoryType: "DDR5",
      sataPorts: 4,
      socket: "LGA1700",
    },
    stock: 7,
  },
  {
    attributes: { networking: "2.5GbE + Wi-Fi 6E", vrm: "8+1+1" },
    brand: "Gigabyte",
    categorySlug: "motherboard",
    description:
      "ATX LGA1700 board with three M.2 slots at a mid-range price. A full-size alternative to the micro-ATX B760 boards.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Gigabyte-B760-GAMING-X-AX-DDR5-Intel-LGA-1700-Motherboard-20231025-090426.jpg",
    inventory: {
      lastRestockedDaysAgo: 10,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 12,
    },
    name: "Gigabyte B760 GAMING X AX",
    priceRupees: 16_999,
    sku: "MBD-GIGA-B760-GX",
    specs: {
      chipset: "B760",
      formFactor: "ATX",
      m2Slots: 3,
      memoryCapacityGb: 192,
      memorySlots: 4,
      memorySpeedMhz: 7600,
      memoryType: "DDR5",
      sataPorts: 4,
      socket: "LGA1700",
    },
    stock: 10,
  },
  {
    attributes: { networking: "5GbE + Wi-Fi 7", vrm: "14+2+1" },
    brand: "MSI",
    categorySlug: "motherboard",
    description:
      "Premium AM5 motherboard for Ryzen 9000 and 7000 series with dual USB4 40Gbps, four M.2 slots (one PCIe 5.0), 5GbE LAN, and Wi-Fi 7.",
    imageUrl: "https://m.media-amazon.com/images/I/81xQj6yq1dL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 10,
    },
    name: "MSI MAG X870 Tomahawk WiFi",
    priceRupees: 28_999,
    sku: "MBD-MSI-X870-TMHK",
    specs: {
      chipset: "X870",
      formFactor: "ATX",
      m2Slots: 4,
      memoryCapacityGb: 256,
      memorySlots: 4,
      memorySpeedMhz: 8400,
      memoryType: "DDR5",
      sataPorts: 4,
      socket: "AM5",
    },
    stock: 8,
  },
  {
    attributes: { networking: "2.5GbE + Wi-Fi 7", vrm: "16+1+2+1" },
    brand: "ASUS",
    categorySlug: "motherboard",
    description:
      "Robust LGA1851 motherboard designed for Intel Core Ultra 200 series processors with PCIe 5.0 x16, Thunderbolt 4, and four M.2 slots.",
    imageUrl: "https://m.media-amazon.com/images/I/81L-U4VqV8L._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 7,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 14,
    },
    name: "ASUS TUF Gaming Z890-PLUS WiFi",
    priceRupees: 31_499,
    sku: "MBD-ASUS-Z890-PLUS",
    specs: {
      chipset: "Z890",
      formFactor: "ATX",
      m2Slots: 4,
      memoryCapacityGb: 192,
      memorySlots: 4,
      memorySpeedMhz: 8600,
      memoryType: "DDR5",
      sataPorts: 4,
      socket: "LGA1851",
    },
    stock: 6,
  },
  {
    attributes: { networking: "2.5GbE + Wi-Fi 7", vrm: "16+2+2" },
    brand: "Gigabyte",
    categorySlug: "motherboard",
    description:
      "High-end AM5 motherboard featuring PCIe 5.0 graphics and SSD support, dual USB4 Type-C ports, and Wi-Fi 7 with EZ-Latch installation.",
    imageUrl: "https://m.media-amazon.com/images/I/81z5t5N4TFL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 10,
      supplierLeadTimeDays: 12,
    },
    name: "Gigabyte X870 AORUS Elite WiFi7",
    priceRupees: 26_999,
    sku: "MBD-GIGA-X870-ELITE",
    specs: {
      chipset: "X870",
      formFactor: "ATX",
      m2Slots: 4,
      memoryCapacityGb: 256,
      memorySlots: 4,
      memorySpeedMhz: 8000,
      memoryType: "DDR5",
      sataPorts: 4,
      socket: "AM5",
    },
    stock: 9,
  },

  // ---------------------------------------------------------------- Memory
  {
    attributes: { kit: "2 x 16GB", latency: "CL30", profile: "EXPO" },
    brand: "Corsair",
    categorySlug: "ram",
    description:
      "32GB DDR5-6000 CL30 kit with EXPO timings. The sweet spot for Ryzen 7000, and comfortable headroom for gaming with a browser open.",
    imageUrl: "https://m.media-amazon.com/images/I/61m8xvVXvvL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 8,
      reorderPoint: 10,
      reorderQuantity: 30,
      supplierLeadTimeDays: 6,
    },
    name: "Corsair Vengeance 32GB DDR5-6000",
    priceRupees: 9499,
    sku: "RAM-CORS-32-6000",
    specs: {
      memoryCapacityGb: 32,
      memorySlots: 2,
      memorySpeedMhz: 6000,
      memoryType: "DDR5",
    },
    stock: 34,
  },
  {
    attributes: { kit: "2 x 16GB", latency: "CL32", profile: "XMP + EXPO" },
    brand: "G.Skill",
    categorySlug: "ram",
    description:
      "32GB DDR5-6400 kit with an aluminium heatspreader. Marginally faster than the 6000 kit and mainly worth it on Intel.",
    imageUrl: "https://m.media-amazon.com/images/I/61bc6zvEIIL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 8,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 20,
      supplierLeadTimeDays: 8,
    },
    name: "G.Skill Trident Z5 32GB DDR5-6400",
    priceRupees: 12_499,
    sku: "RAM-GSKL-32-6400",
    specs: {
      memoryCapacityGb: 32,
      memorySlots: 2,
      memorySpeedMhz: 6400,
      memoryType: "DDR5",
    },
    stock: 17,
  },
  {
    attributes: { kit: "2 x 8GB", latency: "CL40" },
    brand: "Kingston",
    categorySlug: "ram",
    description:
      "16GB DDR5-5600 kit, no heatspreader. Enough for gaming today, and the first thing worth upgrading in a year.",
    imageUrl: "https://m.media-amazon.com/images/I/611n3F+AQJL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 3,
      lowStockThreshold: 10,
      reorderPoint: 12,
      reorderQuantity: 40,
      supplierLeadTimeDays: 5,
    },
    name: "Kingston Fury Beast 16GB DDR5-5600",
    priceRupees: 4999,
    sku: "RAM-KING-16-5600",
    specs: {
      memoryCapacityGb: 16,
      memorySlots: 2,
      memorySpeedMhz: 5600,
      memoryType: "DDR5",
    },
    stock: 9,
  },
  {
    attributes: { kit: "2 x 32GB", latency: "CL30", profile: "EXPO" },
    brand: "Corsair",
    categorySlug: "ram",
    description:
      "64GB DDR5-6000 kit in two sticks, so it still fits a two-slot ITX board. Aimed at video editing and large local models.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/11/CORSAIR-Vengeance-64GB-2-x-32GB-288-Pin-PC-RAM-DDR5-6000-PC5-48000-Desktop-Memory-Model-CMK64GX5M2D6000C40.jpg",
    inventory: {
      lastRestockedDaysAgo: 19,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 10,
    },
    name: "Corsair Vengeance 64GB DDR5-6000",
    priceRupees: 18_999,
    sku: "RAM-CORS-64-6000",
    specs: {
      memoryCapacityGb: 64,
      memorySlots: 2,
      memorySpeedMhz: 6000,
      memoryType: "DDR5",
    },
    stock: 8,
  },
  {
    attributes: { kit: "2 x 16GB", latency: "CL18", profile: "XMP 2.0" },
    brand: "Corsair",
    categorySlug: "ram",
    description:
      "32GB DDR4-3600 kit for AM4 and older Intel boards. DDR4 and DDR5 are not interchangeable — this will not seat in a DDR5 board.",
    imageUrl: "https://m.media-amazon.com/images/I/61uWHA2E5eL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 34,
      lowStockThreshold: 6,
      reorderPoint: 6,
      reorderQuantity: 12,
      supplierLeadTimeDays: 6,
    },
    name: "Corsair Vengeance LPX 32GB DDR4-3600",
    priceRupees: 6299,
    sku: "RAM-CORS-32-3600-D4",
    specs: {
      memoryCapacityGb: 32,
      memorySlots: 2,
      memorySpeedMhz: 3600,
      memoryType: "DDR4",
    },
    stock: 26,
  },
  {
    attributes: { kit: "2 x 8GB", latency: "CL22" },
    brand: "Crucial",
    categorySlug: "ram",
    description:
      "16GB DDR4-3200 kit, the plain option for a budget AM4 build. Also DDR4, and also not compatible with a DDR5 board.",
    imageUrl: "https://m.media-amazon.com/images/I/41c+sFrJk1L._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 28,
      lowStockThreshold: 8,
      reorderPoint: 8,
      reorderQuantity: 20,
      supplierLeadTimeDays: 5,
    },
    name: "Crucial Pro 16GB DDR4-3200",
    priceRupees: 4199,
    sku: "RAM-CRUC-16-3200-D4",
    specs: {
      memoryCapacityGb: 16,
      memorySlots: 2,
      memorySpeedMhz: 3200,
      memoryType: "DDR4",
    },
    stock: 31,
  },
  {
    attributes: { kit: "2 x 16GB", latency: "CL34", profile: "XMP 3.0" },
    brand: "Corsair",
    categorySlug: "ram",
    description:
      "Enthusiast-grade DDR5-7200 kit with forged aluminum heatspreaders and customizable top-bar illumination, engineered for extreme memory bandwidth.",
    imageUrl: "https://m.media-amazon.com/images/I/61k1Tls9qUL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 10,
    },
    name: "Corsair Dominator Titanium RGB 32GB DDR5-7200",
    priceRupees: 19_499,
    sku: "RAM-CORS-32-7200",
    specs: {
      memoryCapacityGb: 32,
      memorySlots: 2,
      memorySpeedMhz: 7200,
      memoryType: "DDR5",
    },
    stock: 11,
  },
  {
    attributes: { kit: "2 x 32GB", latency: "CL30", profile: "EXPO" },
    brand: "G.Skill",
    categorySlug: "ram",
    description:
      "High-density 64GB DDR5 kit optimized for AMD AM5 processors with ultra-low CL30 timings for video editing, 3D workloads, and heavy multitasking.",
    imageUrl: "https://m.media-amazon.com/images/I/61R5a-vN5ZL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 8,
    },
    name: "G.Skill Trident Z5 Neo RGB 64GB DDR5-6000",
    priceRupees: 21_999,
    sku: "RAM-GSKL-64-6000-EXPO",
    specs: {
      memoryCapacityGb: 64,
      memorySlots: 2,
      memorySpeedMhz: 6000,
      memoryType: "DDR5",
    },
    stock: 14,
  },

  // -------------------------------------------------------- Graphics cards
  {
    attributes: { outputs: "3x DP 1.4a, 1x HDMI 2.1", vram: "8GB GDDR6" },
    brand: "Zotac",
    categorySlug: "gpu",
    description:
      "Compact RTX 4060 with 8GB of VRAM and DLSS 3. Comfortable at 1080p, and workable at 1440p with upscaling on.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Zotac-Gaming-GeForce-RTX-4060-8GB-Twin-Edge-OC-Black-Graphic-card-ZT-D40600H-10M-1.jpg",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 14,
    },
    name: "Zotac RTX 4060 Twin Edge",
    priceRupees: 25_999,
    sku: "GPU-ZOT-4060",
    specs: {
      lengthMm: 224,
      memoryCapacityGb: 8,
      pciePowerConnectors: [{ count: 1, pins: 8 }],
      recommendedPsuWatts: 550,
      tdpWatts: 115,
    },
    stock: 4,
  },
  {
    attributes: { outputs: "3x DP 1.4a, 1x HDMI 2.1", vram: "16GB GDDR6" },
    brand: "MSI",
    categorySlug: "gpu",
    description:
      "RTX 4060 Ti with 16GB of VRAM. The extra memory matters at 1440p with texture-heavy titles; the core is the same as the 8GB card.",
    inventory: {
      lastRestockedDaysAgo: 12,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 10,
      supplierLeadTimeDays: 14,
    },
    name: "MSI RTX 4060 Ti Ventus 3X 16G",
    priceRupees: 42_999,
    sku: "GPU-MSI-4060TI-16",
    specs: {
      lengthMm: 308,
      memoryCapacityGb: 16,
      pciePowerConnectors: [{ count: 1, pins: 8 }],
      recommendedPsuWatts: 600,
      tdpWatts: 165,
    },
    stock: 9,
  },
  {
    attributes: { outputs: "3x DP 1.4a, 1x HDMI 2.1", vram: "12GB GDDR6X" },
    brand: "ASUS",
    categorySlug: "gpu",
    description:
      "RTX 4070 SUPER in a two-slot, 227mm shroud that fits cases the longer designs do not. Solid 1440p at high settings without upscaling.",
    inventory: {
      lastRestockedDaysAgo: 7,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 16,
    },
    name: "ASUS Dual RTX 4070 SUPER",
    priceRupees: 57_999,
    sku: "GPU-ASUS-4070S",
    specs: {
      lengthMm: 227,
      memoryCapacityGb: 12,
      pciePowerConnectors: [{ count: 2, pins: 8 }],
      recommendedPsuWatts: 650,
      tdpWatts: 220,
    },
    stock: 11,
  },
  {
    attributes: { outputs: "3x DP 1.4a, 1x HDMI 2.1", vram: "16GB GDDR6X" },
    brand: "Gigabyte",
    categorySlug: "gpu",
    description:
      "RTX 4070 Ti SUPER in a triple-fan 336mm shroud. Fast at 1440p and entry-level 4K — measure the case before ordering.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/GV-N407TSGAMING-OC-16GD.jpg",
    inventory: {
      lastRestockedDaysAgo: 15,
      lowStockThreshold: 2,
      reorderPoint: 3,
      reorderQuantity: 6,
      supplierLeadTimeDays: 18,
    },
    name: "Gigabyte RTX 4070 Ti SUPER Gaming OC",
    priceRupees: 79_999,
    sku: "GPU-GIGA-4070TIS",
    specs: {
      lengthMm: 336,
      memoryCapacityGb: 16,
      pciePowerConnectors: [{ count: 3, pins: 8 }],
      recommendedPsuWatts: 700,
      tdpWatts: 285,
    },
    stock: 4,
  },
  {
    attributes: { outputs: "3x DP 1.4a, 1x HDMI 2.1", vram: "16GB GDDR6X" },
    brand: "MSI",
    categorySlug: "gpu",
    description:
      "RTX 4080 SUPER, 358mm long and 320W. A 4K card that rules out most mid-tower cases and every mid-range power supply.",
    inventory: {
      lastRestockedDaysAgo: 26,
      lowStockThreshold: 2,
      reorderPoint: 2,
      reorderQuantity: 4,
      supplierLeadTimeDays: 21,
    },
    name: "MSI RTX 4080 SUPER Suprim X",
    priceRupees: 110_999,
    sku: "GPU-MSI-4080S",
    specs: {
      lengthMm: 358,
      memoryCapacityGb: 16,
      pciePowerConnectors: [{ count: 3, pins: 8 }],
      recommendedPsuWatts: 850,
      tdpWatts: 320,
    },
    stock: 3,
  },
  {
    attributes: { outputs: "2x DP 2.1, 2x HDMI 2.1", vram: "8GB GDDR6" },
    brand: "Sapphire",
    categorySlug: "gpu",
    description:
      "Radeon RX 7600 at 204mm — the shortest card in the store, and the one that fits a small case without measuring.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Sapphire-PULSE-AMD-Radeon-RX-7600-8GB-Graphic-Card-11324-01-20G.jpg",
    inventory: {
      lastRestockedDaysAgo: 9,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 12,
    },
    name: "Sapphire Pulse RX 7600",
    priceRupees: 22_999,
    sku: "GPU-SAPP-7600",
    specs: {
      lengthMm: 204,
      memoryCapacityGb: 8,
      pciePowerConnectors: [{ count: 1, pins: 8 }],
      recommendedPsuWatts: 550,
      tdpWatts: 165,
    },
    stock: 14,
  },
  {
    attributes: { outputs: "2x DP 2.1, 2x HDMI 2.1", vram: "16GB GDDR6" },
    brand: "PowerColor",
    categorySlug: "gpu",
    description:
      "Radeon RX 7800 XT with 16GB of VRAM. Raster performance around the 4070 SUPER at a lower price, with weaker ray tracing.",
    inventory: {
      lastRestockedDaysAgo: 11,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 16,
    },
    name: "PowerColor Hellhound RX 7800 XT",
    priceRupees: 52_999,
    sku: "GPU-PWRC-7800XT",
    specs: {
      lengthMm: 320,
      memoryCapacityGb: 16,
      pciePowerConnectors: [{ count: 2, pins: 8 }],
      recommendedPsuWatts: 700,
      tdpWatts: 263,
    },
    stock: 6,
  },
  {
    attributes: {
      note: "Imported unit — the distributor publishes no card dimensions or connector layout.",
      vram: "8GB GDDR6",
    },
    brand: "Intel",
    categorySlug: "gpu",
    description:
      "Arc A750, imported. The distributor lists no board length and no power-connector layout, so case fit and PSU cabling cannot be confirmed from the datasheet.",
    imageUrl: "https://m.media-amazon.com/images/I/81K0ZRZsQmL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 41,
      lowStockThreshold: 2,
      supplierLeadTimeDays: 30,
    },
    name: "Intel Arc A750 (imported)",
    priceRupees: 19_999,
    sku: "GPU-INT-A750",
    specs: {
      memoryCapacityGb: 8,
      recommendedPsuWatts: 600,
      tdpWatts: 225,
    },
    stock: 5,
  },
  {
    attributes: { architecture: "Blackwell", outputs: "3x DP 2.1b, 1x HDMI 2.1a", vram: "32GB GDDR7" },
    brand: "NVIDIA",
    categorySlug: "gpu",
    description:
      "The pinnacle of consumer GPUs. Powered by the Blackwell architecture with 32GB GDDR7, DLSS 4 Multi-Frame Generation, and uncompromised 4K/8K performance.",
    imageUrl: "https://m.media-amazon.com/images/I/71Z81jXU9uL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 3,
      lowStockThreshold: 2,
      reorderPoint: 2,
      reorderQuantity: 4,
      supplierLeadTimeDays: 21,
    },
    name: "NVIDIA GeForce RTX 5090 Founders Edition",
    priceRupees: 189_999,
    sku: "GPU-NV-5090-FE",
    specs: {
      lengthMm: 304,
      memoryCapacityGb: 32,
      pciePowerConnectors: [{ count: 1, pins: 16 }],
      recommendedPsuWatts: 1000,
      tdpWatts: 600,
    },
    stock: 3,
  },
  {
    attributes: { architecture: "Blackwell", outputs: "3x DP 2.1b, 1x HDMI 2.1a", vram: "16GB GDDR7" },
    brand: "NVIDIA",
    categorySlug: "gpu",
    description:
      "Next-generation Blackwell graphics card delivering exceptional 4K gaming and generative AI performance with 16GB GDDR7 on a 256-bit bus.",
    imageUrl: "https://m.media-amazon.com/images/I/71Z81jXU9uL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 2,
      reorderPoint: 3,
      reorderQuantity: 6,
      supplierLeadTimeDays: 16,
    },
    name: "NVIDIA GeForce RTX 5080 Founders Edition",
    priceRupees: 109_999,
    sku: "GPU-NV-5080-FE",
    specs: {
      lengthMm: 304,
      memoryCapacityGb: 16,
      pciePowerConnectors: [{ count: 1, pins: 16 }],
      recommendedPsuWatts: 850,
      tdpWatts: 400,
    },
    stock: 5,
  },
  {
    attributes: { architecture: "Blackwell", outputs: "3x DP 2.1b, 1x HDMI 2.1a", vram: "16GB GDDR7" },
    brand: "Zotac",
    categorySlug: "gpu",
    description:
      "High-performance Blackwell GPU featuring 16GB of ultra-fast GDDR7 memory, triple IceStorm cooling, and DLSS 4 support for 1440p and 4K gaming.",
    imageUrl: "https://m.media-amazon.com/images/I/71Z81jXU9uL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 14,
    },
    name: "Zotac Gaming GeForce RTX 5070 Ti Solid",
    priceRupees: 79_999,
    sku: "GPU-ZOT-5070TI",
    specs: {
      lengthMm: 304,
      memoryCapacityGb: 16,
      pciePowerConnectors: [{ count: 1, pins: 16 }],
      recommendedPsuWatts: 750,
      tdpWatts: 300,
    },
    stock: 8,
  },
  {
    attributes: { architecture: "Blackwell", outputs: "3x DP 2.1b, 1x HDMI 2.1a", vram: "12GB GDDR7" },
    brand: "ASUS",
    categorySlug: "gpu",
    description:
      "Compact dual-fan Blackwell GPU with 12GB GDDR7 memory. The sweet-spot enthusiast card for ultra-settings 1440p gaming with full ray tracing.",
    imageUrl: "https://m.media-amazon.com/images/I/71Z81jXU9uL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 7,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 12,
    },
    name: "ASUS Dual GeForce RTX 5070",
    priceRupees: 59_999,
    sku: "GPU-ASUS-5070",
    specs: {
      lengthMm: 245,
      memoryCapacityGb: 12,
      pciePowerConnectors: [{ count: 1, pins: 16 }],
      recommendedPsuWatts: 650,
      tdpWatts: 250,
    },
    stock: 12,
  },

  // --------------------------------------------------------------- Storage
  {
    attributes: { capacity: "1TB", read: "7450 MB/s" },
    brand: "Samsung",
    categorySlug: "storage",
    description:
      "1TB PCIe 4.0 NVMe drive with a DRAM cache and a five-year warranty. Fast enough that the next bottleneck is elsewhere.",
    imageUrl: "https://m.media-amazon.com/images/I/71XHEQZZW+L._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 3,
      lowStockThreshold: 8,
      reorderPoint: 10,
      reorderQuantity: 25,
      supplierLeadTimeDays: 6,
    },
    name: "Samsung 990 PRO 1TB",
    priceRupees: 8999,
    sku: "SSD-SAMS-990P-1T",
    specs: {
      extra: { capacityGb: 1000 },
      storageInterface: "M.2 NVMe",
    },
    stock: 29,
  },
  {
    attributes: { capacity: "2TB", read: "7450 MB/s" },
    brand: "Samsung",
    categorySlug: "storage",
    description:
      "2TB PCIe 4.0 NVMe drive. The right size when a game library outgrows a terabyte, which it does faster than expected.",
    imageUrl: "https://m.media-amazon.com/images/I/71ByVZ1x2vL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 6,
    },
    name: "Samsung 990 PRO 2TB",
    priceRupees: 15_499,
    sku: "SSD-SAMS-990P-2T",
    specs: {
      extra: { capacityGb: 2000 },
      storageInterface: "M.2 NVMe",
    },
    stock: 16,
  },
  {
    attributes: { capacity: "1TB", read: "5150 MB/s" },
    brand: "Western Digital",
    categorySlug: "storage",
    description:
      "1TB DRAM-less PCIe 4.0 NVMe drive. Slower on sustained writes than the 990 PRO and indistinguishable while gaming.",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 10,
      reorderPoint: 12,
      reorderQuantity: 30,
      supplierLeadTimeDays: 5,
    },
    name: "WD Black SN770 1TB",
    priceRupees: 5499,
    sku: "SSD-WD-SN770-1T",
    specs: {
      extra: { capacityGb: 1000 },
      storageInterface: "M.2 NVMe",
    },
    stock: 6,
  },
  {
    attributes: { capacity: "2TB", read: "5000 MB/s" },
    brand: "Crucial",
    categorySlug: "storage",
    description:
      "2TB PCIe 4.0 NVMe drive at the lowest cost per terabyte in the store. Bulk storage that still boots quickly.",
    imageUrl: "https://m.media-amazon.com/images/I/51xZaoS+Q1L._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 31,
      lowStockThreshold: 6,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 7,
    },
    name: "Crucial P3 Plus 2TB",
    priceRupees: 11_499,
    sku: "SSD-CRUC-P3P-2T",
    specs: {
      extra: { capacityGb: 2000 },
      storageInterface: "M.2 NVMe",
    },
    stock: 33,
  },
  {
    attributes: { capacity: "1TB", read: "560 MB/s" },
    brand: "Crucial",
    categorySlug: "storage",
    description:
      "1TB 2.5-inch SATA SSD. Uses a SATA port rather than an M.2 slot, which is the point once the board has run out of M.2 slots.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Crucial-MX500-1TB-SATA-III-3D-NAND-SSD-CT1000MX500SSD1.jpg",
    inventory: {
      lastRestockedDaysAgo: 24,
      lowStockThreshold: 6,
      reorderPoint: 6,
      reorderQuantity: 12,
      supplierLeadTimeDays: 7,
    },
    name: "Crucial MX500 1TB SATA",
    priceRupees: 5299,
    sku: "SSD-CRUC-MX500-1T",
    specs: {
      extra: { capacityGb: 1000 },
      storageInterface: "SATA",
    },
    stock: 22,
  },
  {
    attributes: { capacity: "2TB", rpm: 7200 },
    brand: "Seagate",
    categorySlug: "storage",
    description:
      "2TB 7200rpm mechanical drive on SATA. Slow to boot from, and still the cheapest place to keep recordings and archives.",
    imageUrl: "https://m.media-amazon.com/images/I/71bT6WoeYHL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 45,
      lowStockThreshold: 5,
      reorderPoint: 5,
      reorderQuantity: 10,
      supplierLeadTimeDays: 8,
    },
    name: "Seagate BarraCuda 2TB HDD",
    priceRupees: 4299,
    sku: "HDD-SEAG-BC-2T",
    specs: {
      extra: { capacityGb: 2000 },
      storageInterface: "SATA",
    },
    stock: 19,
  },
  {
    attributes: { capacity: "2TB", interface: "PCIe 5.0 x4", read: "14500 MB/s", write: "12700 MB/s" },
    brand: "Crucial",
    categorySlug: "storage",
    description:
      "Blistering PCIe Gen 5 NVMe SSD delivering up to 14,500 MB/s reads with integrated premium heatsink. Built for extreme content creation and DirectStorage gaming.",
    imageUrl: "https://m.media-amazon.com/images/I/61jZkZ+p2SL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 10,
    },
    name: "Crucial T705 2TB PCIe Gen 5 NVMe SSD",
    priceRupees: 25_999,
    sku: "SSD-CRUC-T705-2T",
    specs: {
      extra: { capacityGb: 2000 },
      storageInterface: "NVMe",
    },
    stock: 9,
  },
  {
    attributes: { capacity: "2TB", interface: "PCIe 4.0 x4", read: "7250 MB/s", write: "6300 MB/s" },
    brand: "Samsung",
    categorySlug: "storage",
    description:
      "High-efficiency PCIe 4.0 SSD offering top-tier sustained read speeds and enhanced power efficiency for modern gaming rigs and productivity PCs.",
    imageUrl: "https://m.media-amazon.com/images/I/71XHEQZZW+L._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 6,
      reorderPoint: 8,
      reorderQuantity: 20,
      supplierLeadTimeDays: 7,
    },
    name: "Samsung 990 EVO Plus 2TB NVMe SSD",
    priceRupees: 14_999,
    sku: "SSD-SAMS-990EVOP-2T",
    specs: {
      extra: { capacityGb: 2000 },
      storageInterface: "NVMe",
    },
    stock: 18,
  },

  // -------------------------------------------------------- Power supplies
  {
    attributes: { efficiency: "80+ Gold", modular: "fully" },
    brand: "Corsair",
    categorySlug: "psu",
    description:
      "750W fully modular 80+ Gold supply with four 8-pin PCIe connectors and a ten-year warranty. Enough for anything short of a 4080.",
    imageUrl: "https://m.media-amazon.com/images/I/61qrDDfNbNL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 10,
    },
    name: "Corsair RM750e 750W Gold",
    priceRupees: 8999,
    sku: "PSU-CORS-RM750E",
    specs: {
      formFactor: "ATX",
      lengthMm: 140,
      pciePowerConnectors: [{ count: 4, pins: 8 }],
      psuWattage: 750,
    },
    stock: 18,
  },
  {
    attributes: { efficiency: "80+ Gold", modular: "fully" },
    brand: "Corsair",
    categorySlug: "psu",
    description:
      "850W fully modular 80+ Gold supply with six 8-pin PCIe connectors. The right size for a 4070 Ti SUPER or an unlocked Core i7.",
    imageUrl: "https://m.media-amazon.com/images/I/61eKAbgBZRL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 8,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 10,
    },
    name: "Corsair RM850x 850W Gold",
    priceRupees: 13_499,
    sku: "PSU-CORS-RM850X",
    specs: {
      formFactor: "ATX",
      lengthMm: 160,
      pciePowerConnectors: [{ count: 6, pins: 8 }],
      psuWattage: 850,
    },
    stock: 12,
  },
  {
    attributes: { efficiency: "80+ Gold", modular: "fully" },
    brand: "Seasonic",
    categorySlug: "psu",
    description:
      "1000W fully modular 80+ Gold supply. Overkill for most builds here, and the only unit with headroom for a 4080 SUPER beside a 14700K.",
    imageUrl: "https://m.media-amazon.com/images/I/81i7j8lF5sL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 21,
      lowStockThreshold: 2,
      reorderPoint: 3,
      reorderQuantity: 6,
      supplierLeadTimeDays: 14,
    },
    name: "Seasonic Focus GX-1000 1000W Gold",
    priceRupees: 17_999,
    sku: "PSU-SEAS-GX1000",
    specs: {
      formFactor: "ATX",
      lengthMm: 150,
      pciePowerConnectors: [{ count: 6, pins: 8 }],
      psuWattage: 1000,
    },
    stock: 5,
  },
  {
    attributes: { efficiency: "80+ Bronze", modular: "non-modular" },
    brand: "MSI",
    categorySlug: "psu",
    description:
      "650W 80+ Bronze supply with two 8-pin PCIe connectors. Sized for a mid-range build with a single-connector card.",
    imageUrl: "https://m.media-amazon.com/images/I/71pU8A2UE9L._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 8,
      reorderPoint: 10,
      reorderQuantity: 25,
      supplierLeadTimeDays: 8,
    },
    name: "MSI MAG A650BN 650W Bronze",
    priceRupees: 4499,
    sku: "PSU-MSI-A650BN",
    specs: {
      formFactor: "ATX",
      lengthMm: 140,
      pciePowerConnectors: [{ count: 2, pins: 8 }],
      psuWattage: 650,
    },
    stock: 5,
  },
  {
    attributes: { efficiency: "80+ Bronze", modular: "non-modular" },
    brand: "Cooler Master",
    categorySlug: "psu",
    description:
      "550W 80+ Bronze supply with two 8-pin PCIe connectors. Fine behind a 4060 or an RX 7600, and out of its depth above that.",
    imageUrl: "https://m.media-amazon.com/images/I/81JVYq2gyjL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 16,
      lowStockThreshold: 6,
      reorderPoint: 8,
      reorderQuantity: 20,
      supplierLeadTimeDays: 8,
    },
    name: "Cooler Master MWE 550 Bronze V2",
    priceRupees: 3999,
    sku: "PSU-CLRM-MWE550",
    specs: {
      formFactor: "ATX",
      lengthMm: 140,
      pciePowerConnectors: [{ count: 2, pins: 8 }],
      psuWattage: 550,
    },
    stock: 24,
  },
  {
    attributes: { efficiency: "80+ Bronze", modular: "non-modular" },
    brand: "Antec",
    categorySlug: "psu",
    description:
      "450W 80+ Bronze supply with a single 8-pin PCIe connector. An office-build unit, and the wrong answer under any discrete card here.",
    inventory: {
      lastRestockedDaysAgo: 52,
      lowStockThreshold: 10,
      reorderPoint: 10,
      reorderQuantity: 15,
      supplierLeadTimeDays: 6,
    },
    name: "Antec CSK 450 450W",
    priceRupees: 2999,
    sku: "PSU-ANTC-CSK450",
    specs: {
      formFactor: "ATX",
      lengthMm: 140,
      pciePowerConnectors: [{ count: 1, pins: 8 }],
      psuWattage: 450,
    },
    stock: 30,
  },
  {
    attributes: { efficiency: "80+ Platinum", modular: "fully" },
    brand: "Corsair",
    categorySlug: "psu",
    description:
      "750W SFX supply for small-form-factor builds. Only fits a case that takes SFX — it will not bolt into an ATX bay.",
    imageUrl: "https://m.media-amazon.com/images/I/716AZ6NQNuL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 18,
      lowStockThreshold: 2,
      reorderPoint: 3,
      reorderQuantity: 6,
      supplierLeadTimeDays: 18,
    },
    name: "Corsair SF750 750W Platinum SFX",
    priceRupees: 18_499,
    sku: "PSU-CORS-SF750",
    specs: {
      formFactor: "SFX",
      lengthMm: 100,
      pciePowerConnectors: [{ count: 4, pins: 8 }],
      psuWattage: 750,
    },
    stock: 4,
  },
  {
    attributes: { efficiency: "80+ Gold / Cybenetics Gold", modular: "fully", standard: "ATX 3.1" },
    brand: "Corsair",
    categorySlug: "psu",
    description:
      "1000W fully modular power supply compliant with ATX 3.1 and PCIe 5.1 standards. Features native 12V-2x6 cable and Japanese 105°C capacitors.",
    imageUrl: "https://m.media-amazon.com/images/I/61eKAbgBZRL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 10,
    },
    name: "Corsair RM1000x ATX 3.1 1000W Gold",
    priceRupees: 17_499,
    sku: "PSU-CORS-RM1000X-31",
    specs: {
      formFactor: "ATX",
      lengthMm: 160,
      pciePowerConnectors: [
        { count: 1, pins: 16 },
        { count: 4, pins: 8 },
      ],
      psuWattage: 1000,
    },
    stock: 11,
  },
  {
    attributes: { efficiency: "80+ Gold", modular: "fully", standard: "ATX 3.0" },
    brand: "Seasonic",
    categorySlug: "psu",
    description:
      "1200W flagship power supply engineered for high-wattage GPUs like the RTX 5090, offering native 12V-2x6 power delivery and silent hybrid fan control.",
    imageUrl: "https://m.media-amazon.com/images/I/71z78qP2fBL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 8,
      lowStockThreshold: 2,
      reorderPoint: 3,
      reorderQuantity: 6,
      supplierLeadTimeDays: 14,
    },
    name: "Seasonic Vertex GX-1200 1200W Gold",
    priceRupees: 23_999,
    sku: "PSU-SEAS-VTX1200",
    specs: {
      formFactor: "ATX",
      lengthMm: 160,
      pciePowerConnectors: [
        { count: 1, pins: 16 },
        { count: 4, pins: 8 },
      ],
      psuWattage: 1200,
    },
    stock: 5,
  },

  // ----------------------------------------------------------------- Cases
  {
    attributes: { drives: "2x 2.5in, 1x 3.5in", panel: "mesh front" },
    brand: "NZXT",
    categorySlug: "case",
    description:
      "Mid-tower ATX case with a mesh front and 365mm of card clearance. Takes all but the longest triple-fan cards.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/NZXT-H5-Flow-Compact-Mid-Tower-Airflow-Black-Cabinet-CC-H51FB-01.jpg",
    inventory: {
      lastRestockedDaysAgo: 7,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 12,
    },
    name: "NZXT H5 Flow",
    priceRupees: 7499,
    sku: "CSE-NZXT-H5F",
    specs: {
      formFactor: "ATX",
      heightMm: 446,
      lengthMm: 446,
      maxCoolerHeightMm: 165,
      maxGpuLengthMm: 365,
      widthMm: 227,
    },
    stock: 13,
  },
  {
    attributes: { drives: "2x 2.5in, 2x 3.5in", panel: "mesh front" },
    brand: "Lian Li",
    categorySlug: "case",
    description:
      "Mid-tower ATX case with 392mm of card clearance and 180mm for a cooler — the only case here that takes every part in the store.",
    imageUrl: "https://m.media-amazon.com/images/I/81+FXUfmNDL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 9,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 14,
    },
    name: "Lian Li Lancool 216",
    priceRupees: 8999,
    sku: "CSE-LIAN-L216",
    specs: {
      formFactor: "ATX",
      heightMm: 480,
      lengthMm: 462,
      maxCoolerHeightMm: 180,
      maxGpuLengthMm: 392,
      widthMm: 228,
    },
    stock: 11,
  },
  {
    attributes: { drives: "2x 2.5in, 2x 3.5in", panel: "mesh front" },
    brand: "Corsair",
    categorySlug: "case",
    description:
      "Mid-tower ATX case with tidy cable routing and 360mm of card clearance. The safe default for a first build.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Corsair-4000D-AIRFLOW-Tempered-Glass-Mid-Tower-ATX-Black-Cabinet-CC-9011200-WW.jpg",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 12,
    },
    name: "Corsair 4000D Airflow",
    priceRupees: 8499,
    sku: "CSE-CORS-4000D",
    specs: {
      formFactor: "ATX",
      heightMm: 453,
      lengthMm: 466,
      maxCoolerHeightMm: 170,
      maxGpuLengthMm: 360,
      widthMm: 230,
    },
    stock: 16,
  },
  {
    attributes: { drives: "2x 2.5in", psuSupport: "SFX / SFX-L" },
    brand: "Cooler Master",
    categorySlug: "case",
    description:
      "18-litre Mini-ITX case taking an SFX supply, a 330mm card and a 155mm cooler. Nothing larger goes in, in any dimension.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Cooler-Master-MasterBox-NR200P-Cabinet-Black.jpg",
    inventory: {
      lastRestockedDaysAgo: 23,
      lowStockThreshold: 2,
      reorderPoint: 3,
      reorderQuantity: 6,
      supplierLeadTimeDays: 21,
    },
    name: "Cooler Master NR200P",
    priceRupees: 9499,
    sku: "CSE-CLRM-NR200P",
    specs: {
      formFactor: "ITX",
      heightMm: 292,
      lengthMm: 376,
      maxCoolerHeightMm: 155,
      maxGpuLengthMm: 330,
      widthMm: 185,
    },
    stock: 6,
  },
  {
    attributes: { drives: "2x 2.5in, 1x 3.5in", panel: "tempered glass" },
    brand: "Deepcool",
    categorySlug: "case",
    description:
      "Micro-ATX case with 320mm of card clearance. Fits a mid-range build and stops well short of the longer graphics cards.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/DeepCool-CH370-M-ATX-Mini-Tower-Cabinet-Black-R-CH370-BKNAM1-G-1.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 6,
      reorderPoint: 8,
      reorderQuantity: 20,
      supplierLeadTimeDays: 10,
    },
    name: "Deepcool CH370",
    priceRupees: 4499,
    sku: "CSE-DEEP-CH370",
    specs: {
      formFactor: "mATX",
      heightMm: 400,
      lengthMm: 380,
      maxCoolerHeightMm: 165,
      maxGpuLengthMm: 320,
      widthMm: 205,
    },
    stock: 21,
  },
  {
    attributes: { drives: "2x 2.5in, 2x 3.5in", panel: "walnut front" },
    brand: "Fractal Design",
    categorySlug: "case",
    description:
      "Mid-tower ATX case with a walnut front panel. Costs more than the airflow it buys, and looks like furniture rather than hardware.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Fractal-Design-North-Charcoal-Black-TG-Dark-Case-Cabinet-FD-C-NOR1C-02.jpg",
    inventory: {
      lastRestockedDaysAgo: 14,
      lowStockThreshold: 2,
      reorderPoint: 3,
      reorderQuantity: 6,
      supplierLeadTimeDays: 18,
    },
    name: "Fractal Design North",
    priceRupees: 14_999,
    sku: "CSE-FRAC-NORTH",
    specs: {
      formFactor: "ATX",
      heightMm: 469,
      lengthMm: 447,
      maxCoolerHeightMm: 170,
      maxGpuLengthMm: 355,
      widthMm: 215,
    },
    stock: 5,
  },
  {
    attributes: { drives: "1x 2.5in, 1x 3.5in", panel: "tempered glass" },
    brand: "Ant Esports",
    categorySlug: "case",
    description:
      "Budget micro-ATX case with 300mm of card clearance — the tightest in the store, and the first thing to check against a triple-fan card.",
    inventory: {
      lastRestockedDaysAgo: 38,
      lowStockThreshold: 10,
      reorderPoint: 10,
      reorderQuantity: 20,
      supplierLeadTimeDays: 7,
    },
    name: "Ant Esports ICE-200TG",
    priceRupees: 2999,
    sku: "CSE-ANT-ICE200",
    specs: {
      formFactor: "mATX",
      heightMm: 385,
      lengthMm: 355,
      maxCoolerHeightMm: 160,
      maxGpuLengthMm: 300,
      widthMm: 195,
    },
    stock: 29,
  },
  {
    attributes: { panel: "three-sided tempered glass", support: "E-ATX / ATX" },
    brand: "Lian Li",
    categorySlug: "case",
    description:
      "Showcase dual-chamber mid-tower chassis developed in collaboration with PCMR, offering panoramic glass views and support for up to 455mm graphics cards.",
    imageUrl: "https://m.media-amazon.com/images/I/81+FXUfmNDL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 14,
    },
    name: "Lian Li O11 Vision",
    priceRupees: 13_999,
    sku: "CSE-LIAN-O11V",
    specs: {
      formFactor: "ATX",
      heightMm: 464,
      lengthMm: 480,
      maxCoolerHeightMm: 167,
      maxGpuLengthMm: 455,
      widthMm: 304,
    },
    stock: 9,
  },
  {
    attributes: { panel: "real oak front / mesh", support: "E-ATX / ATX" },
    brand: "Fractal Design",
    categorySlug: "case",
    description:
      "Spacious Scandinavian design case featuring natural wood front accents, exceptional airflow, and clearance for 413mm GPUs and 420mm radiators.",
    imageUrl: "https://m.media-amazon.com/images/I/71Yj14g-rLL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 7,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 16,
    },
    name: "Fractal Design North XL",
    priceRupees: 16_999,
    sku: "CSE-FRAC-NORTHXL",
    specs: {
      formFactor: "ATX",
      heightMm: 509,
      lengthMm: 503,
      maxCoolerHeightMm: 185,
      maxGpuLengthMm: 413,
      widthMm: 240,
    },
    stock: 7,
  },

  // ------------------------------------------------------------ CPU cooler
  {
    attributes: { fans: 1, type: "air tower" },
    brand: "DeepCool",
    categorySlug: "cooler",
    description:
      "Single-tower air cooler rated to about 220W, 155mm tall. Handles a 7600 or a 13400F without noise complaints.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/DeepCool-AK400-High-Performance-CPU-Cooler-Black-R-AK400-BKNNMN-G-1.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 8,
      reorderPoint: 10,
      reorderQuantity: 25,
      supplierLeadTimeDays: 8,
    },
    name: "DeepCool AK400",
    priceRupees: 2799,
    sku: "COL-DEEP-AK400",
    specs: {
      heightMm: 155,
      socket: "AM5,AM4,LGA1700,LGA1200",
      tdpWatts: 220,
    },
    stock: 32,
  },
  {
    attributes: { fans: 2, type: "dual-tower air" },
    brand: "Thermalright",
    categorySlug: "cooler",
    description:
      "Dual-tower air cooler rated to about 265W at 155mm tall. The value benchmark — near-flagship cooling for the price of a fan.",
    imageUrl: "https://m.media-amazon.com/images/I/71j6VKsz-fL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 3,
      lowStockThreshold: 10,
      reorderPoint: 12,
      reorderQuantity: 30,
      supplierLeadTimeDays: 8,
    },
    name: "Thermalright Peerless Assassin 120 SE",
    priceRupees: 3499,
    sku: "COL-THRM-PA120",
    specs: {
      heightMm: 155,
      socket: "AM5,AM4,LGA1700,LGA1200",
      tdpWatts: 265,
    },
    stock: 27,
  },
  {
    attributes: { fans: 2, type: "dual-tower air" },
    brand: "Noctua",
    categorySlug: "cooler",
    description:
      "Dual-tower air cooler, 165mm tall and rated to about 250W. Quiet under sustained load, and too tall for a small case.",
    imageUrl: "https://m.media-amazon.com/images/I/91Hw1zcAIjL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 17,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 16,
    },
    name: "Noctua NH-D15",
    priceRupees: 9499,
    sku: "COL-NOCT-NHD15",
    specs: {
      heightMm: 165,
      socket: "AM5,AM4,LGA1700",
      tdpWatts: 250,
    },
    stock: 7,
  },
  {
    attributes: { fans: 1, type: "air tower" },
    brand: "Cooler Master",
    categorySlug: "cooler",
    description:
      "Single-tower air cooler, 159mm tall. The mounting kit covers AM4 and LGA1700 only — there is no AM5 bracket in the box.",
    imageUrl: "https://m.media-amazon.com/images/I/81o-F9OX7fL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 33,
      lowStockThreshold: 6,
      reorderPoint: 6,
      reorderQuantity: 12,
      supplierLeadTimeDays: 10,
    },
    name: "Cooler Master Hyper 212 Black",
    priceRupees: 2299,
    sku: "COL-CLRM-H212B",
    specs: {
      heightMm: 159,
      socket: "AM4,LGA1700,LGA1200",
      tdpWatts: 150,
    },
    stock: 23,
  },
  {
    attributes: { fans: 3, radiator: "360mm", type: "AIO liquid" },
    brand: "Arctic",
    categorySlug: "cooler",
    description:
      "360mm all-in-one liquid cooler rated beyond 350W. The only cooler here that keeps a 14700K at full boost, and it needs a case with a 360mm mount.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Arctic-Liquid-Freezer-III-360-Cpu-Liquid-Cooler-ACFRE00136A.jpg",
    inventory: {
      lastRestockedDaysAgo: 10,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 14,
    },
    name: "Arctic Liquid Freezer III 360",
    priceRupees: 12_499,
    sku: "COL-ARCT-LF3-360",
    specs: {
      heightMm: 63,
      socket: "AM5,AM4,LGA1700",
      tdpWatts: 350,
    },
    stock: 9,
  },
  {
    attributes: { fans: 1, type: "low profile" },
    brand: "Noctua",
    categorySlug: "cooler",
    description:
      "37mm low-profile cooler for Intel small-form-factor builds. Rated to about 95W, and mounts on LGA1700 and LGA1200 only.",
    imageUrl: "https://m.media-amazon.com/images/I/71av9uxBMRL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 29,
      lowStockThreshold: 2,
      reorderPoint: 2,
      reorderQuantity: 5,
      supplierLeadTimeDays: 21,
    },
    name: "Noctua NH-L9i-17xx",
    priceRupees: 5499,
    sku: "COL-NOCT-NHL9I",
    specs: {
      heightMm: 37,
      socket: "LGA1700,LGA1200",
      tdpWatts: 95,
    },
    stock: 4,
  },
  {
    attributes: { fans: 2, height: "157mm", type: "dual-tower air" },
    brand: "Thermalright",
    categorySlug: "cooler",
    description:
      "Dual-tower seven-heatpipe air cooler with high-performance TL-K12 fans. Dissipates up to 280W TDP while keeping noise levels exceptionally low.",
    imageUrl: "https://m.media-amazon.com/images/I/71j6VKsz-fL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 3,
      lowStockThreshold: 8,
      reorderPoint: 10,
      reorderQuantity: 25,
      supplierLeadTimeDays: 8,
    },
    name: "Thermalright Phantom Spirit 120 EVO",
    priceRupees: 4999,
    sku: "COL-THRM-PS120EVO",
    specs: {
      heightMm: 157,
      socket: "AM5,AM4,LGA1851,LGA1700,LGA1200",
      tdpWatts: 280,
    },
    stock: 22,
  },
  {
    attributes: { fans: 3, radiator: "360mm", type: "AIO liquid with VRM fan" },
    brand: "Arctic",
    categorySlug: "cooler",
    description:
      "Award-winning 360mm liquid cooler featuring a thick 38mm radiator, integrated active VRM fan, and native LGA1851/AM5 contact frame.",
    imageUrl: "https://www.primeabgb.com/wp-content/uploads/2025/08/Arctic-Liquid-Freezer-III-360-Cpu-Liquid-Cooler-ACFRE00136A.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 10,
      supplierLeadTimeDays: 14,
    },
    name: "Arctic Liquid Freezer III 360 A-RGB",
    priceRupees: 11_499,
    sku: "COL-ARCT-LF3-360-ARGB",
    specs: {
      heightMm: 65,
      socket: "AM5,AM4,LGA1851,LGA1700",
      tdpWatts: 350,
    },
    stock: 12,
  },

  // ------------------------------------------------------------- Case fans
  {
    attributes: { pack: 5, size: "120mm" },
    brand: "Arctic",
    categorySlug: "fan",
    description:
      "Five-pack of 120mm PWM fans that daisy-chain off one header. The cheapest way to fix a case with poor airflow.",
    imageUrl: "https://m.media-amazon.com/images/I/61i9iqYEEbL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 6,
      lowStockThreshold: 8,
      reorderPoint: 10,
      reorderQuantity: 25,
      supplierLeadTimeDays: 8,
    },
    name: "Arctic P12 PWM PST 5-pack",
    priceRupees: 2199,
    sku: "FAN-ARCT-P12-5",
    specs: { extra: { sizeMm: 120 } },
    stock: 26,
  },
  {
    attributes: { pack: 1, size: "120mm" },
    brand: "Noctua",
    categorySlug: "fan",
    description:
      "A single 120mm fan that costs as much as five ordinary ones, and is genuinely quieter at the same airflow.",
    imageUrl: "https://m.media-amazon.com/images/I/81Bh89Q9fcL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 20,
      lowStockThreshold: 5,
      reorderPoint: 5,
      reorderQuantity: 10,
      supplierLeadTimeDays: 16,
    },
    name: "Noctua NF-A12x25 PWM",
    priceRupees: 3299,
    sku: "FAN-NOCT-A12X25",
    specs: { extra: { sizeMm: 120 } },
    stock: 12,
  },
  {
    attributes: { pack: 3, rgb: true, size: "120mm" },
    brand: "Lian Li",
    categorySlug: "fan",
    description:
      "Three interlocking 120mm RGB fans with a single controller. Bought for the look; the airflow is ordinary.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Lian-Li-UNI-Fan-SL120-V2-ARGB-Cabinet-Fan-With-Controller-White-Triple-Pack-G99-12SLV23W-IN.jpg",
    inventory: {
      lastRestockedDaysAgo: 44,
      lowStockThreshold: 4,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 14,
    },
    name: "Lian Li Uni Fan SL120 3-pack",
    priceRupees: 5999,
    sku: "FAN-LIAN-SL120-3",
    specs: { extra: { sizeMm: 120 } },
    stock: 15,
  },

  // -------------------------------------------------------------- Monitors
  {
    attributes: {
      panel: "Nano IPS",
      refresh: "180Hz",
      resolution: "2560x1440",
    },
    brand: "LG",
    categorySlug: "monitor",
    description:
      "27-inch 1440p Nano IPS panel at 180Hz with G-Sync compatibility. The display the 1440p builds in this store are sized for.",
    imageUrl: "https://m.media-amazon.com/images/I/61D+xHBpJTL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 8,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 14,
    },
    name: "LG UltraGear 27GP850-B",
    priceRupees: 28_999,
    sku: "MON-LG-27GP850",
    specs: { extra: { refreshHz: 180, resolution: "2560x1440", sizeIn: 27 } },
    stock: 9,
  },
  {
    attributes: {
      panel: "Fast IPS",
      refresh: "165Hz",
      resolution: "2560x1440",
    },
    brand: "Dell",
    categorySlug: "monitor",
    description:
      "27-inch 1440p Fast IPS panel at 165Hz. Slightly slower than the LG and calibrated better out of the box.",
    imageUrl:
      "https://www.primeabgb.com/wp-content/uploads/2025/08/Dell-27-inch-S2721DGF-Gaming-Series-Monitor.jpg",
    inventory: {
      lastRestockedDaysAgo: 12,
      lowStockThreshold: 3,
      reorderPoint: 3,
      reorderQuantity: 8,
      supplierLeadTimeDays: 14,
    },
    name: "Dell S2721DGF",
    priceRupees: 26_499,
    sku: "MON-DELL-S2721DGF",
    specs: { extra: { refreshHz: 165, resolution: "2560x1440", sizeIn: 27 } },
    stock: 7,
  },
  {
    attributes: {
      panel: "VA curved",
      refresh: "165Hz",
      resolution: "2560x1440",
    },
    brand: "Samsung",
    categorySlug: "monitor",
    description:
      "32-inch curved 1440p VA panel at 165Hz. Deeper blacks than IPS, with visible smearing in dark scenes.",
    imageUrl: "https://m.media-amazon.com/images/I/81eZywfxhML._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 19,
      lowStockThreshold: 3,
      reorderPoint: 4,
      reorderQuantity: 8,
      supplierLeadTimeDays: 12,
    },
    name: "Samsung Odyssey G5 32in",
    priceRupees: 23_999,
    sku: "MON-SAMS-G5-32",
    specs: { extra: { refreshHz: 165, resolution: "2560x1440", sizeIn: 32 } },
    stock: 10,
  },
  {
    attributes: { panel: "IPS", refresh: "180Hz", resolution: "1920x1080" },
    brand: "Acer",
    categorySlug: "monitor",
    description:
      "24-inch 1080p IPS panel at 180Hz. The right pairing for a budget build, and a waste of a 4070.",
    inventory: {
      lastRestockedDaysAgo: 5,
      lowStockThreshold: 5,
      reorderPoint: 6,
      reorderQuantity: 15,
      supplierLeadTimeDays: 10,
    },
    name: "Acer Nitro KG241Y",
    priceRupees: 9999,
    sku: "MON-ACER-KG241Y",
    specs: { extra: { refreshHz: 180, resolution: "1920x1080", sizeIn: 24 } },
    stock: 18,
  },
  {
    attributes: {
      panel: "WOLED",
      refresh: "480Hz",
      resolution: "2560x1440",
      responseTime: "0.03ms",
    },
    brand: "ASUS",
    categorySlug: "monitor",
    description:
      "26.5-inch 1440p WOLED gaming monitor with an incredible 480Hz refresh rate and 0.03ms response time. The ultimate esports display for high-end GPUs.",
    imageUrl: "https://m.media-amazon.com/images/I/81xQj6yq1dL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 4,
      lowStockThreshold: 2,
      reorderPoint: 2,
      reorderQuantity: 4,
      supplierLeadTimeDays: 18,
    },
    name: "ASUS ROG Swift OLED PG27AQDP",
    priceRupees: 98_999,
    sku: "MON-ASUS-PG27AQDP",
    specs: { extra: { refreshHz: 480, resolution: "2560x1440", sizeIn: 27 } },
    stock: 4,
  },

  // ----------------------------------------------------------- Peripherals
  {
    attributes: { dpi: 25_600, weight: "121g" },
    brand: "Logitech",
    categorySlug: "peripheral",
    description:
      "Wired gaming mouse with eleven buttons and adjustable weights. Heavy by current standards, and durable.",
    imageUrl: "https://m.media-amazon.com/images/I/61mpMH5TzkL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 7,
      lowStockThreshold: 8,
      reorderPoint: 10,
      reorderQuantity: 25,
      supplierLeadTimeDays: 8,
    },
    name: "Logitech G502 HERO",
    priceRupees: 3499,
    sku: "PER-LOGI-G502",
    stock: 34,
  },
  {
    attributes: { layout: "TKL", switches: "brown" },
    brand: "Keychron",
    categorySlug: "peripheral",
    description:
      "Tenkeyless mechanical keyboard with hot-swappable switches and Bluetooth for three devices.",
    imageUrl: "https://m.media-amazon.com/images/I/61s6j2TDiLL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 11,
      lowStockThreshold: 4,
      reorderPoint: 5,
      reorderQuantity: 12,
      supplierLeadTimeDays: 12,
    },
    name: "Keychron K8 Pro",
    priceRupees: 9499,
    sku: "PER-KEYC-K8P",
    stock: 13,
  },
  {
    attributes: { drivers: "53mm", mic: "detachable" },
    brand: "HyperX",
    categorySlug: "peripheral",
    description:
      "Wired over-ear headset with a detachable microphone. Comfortable for long sessions, unremarkable for music.",
    imageUrl: "https://m.media-amazon.com/images/I/71AMEEP3HLL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 9,
      lowStockThreshold: 6,
      reorderPoint: 8,
      reorderQuantity: 20,
      supplierLeadTimeDays: 10,
    },
    name: "HyperX Cloud III",
    priceRupees: 7999,
    sku: "PER-HYPX-CLD3",
    stock: 21,
  },
  {
    attributes: { fps: 30, resolution: "1080p" },
    brand: "Logitech",
    categorySlug: "peripheral",
    description:
      "1080p webcam with autofocus and a stereo microphone. Ageing, and still the safe answer for calls and streaming.",
    imageUrl: "https://m.media-amazon.com/images/I/71eGb1FcyiL._SL800_.jpg",
    inventory: {
      lastRestockedDaysAgo: 40,
      lowStockThreshold: 5,
      reorderPoint: 5,
      reorderQuantity: 10,
      supplierLeadTimeDays: 12,
    },
    name: "Logitech C920 HD Pro",
    priceRupees: 6499,
    sku: "PER-LOGI-C920",
    stock: 17,
  },
];

export interface SeedOrder {
  daysAgo: number;
  skus: string[];
}

export interface SeedCancellation {
  daysAgo: number;
  errorMessage: string;
  errorType: string;
  /** Matches `RecoveryAction` in `packages/ai/src/audit.ts`. */
  recoveryAction: string;
  skus: string[];
  status: "cancelled" | "failed";
}

/**
 * Orders that did not complete, and why.
 *
 * `getCancellationSummary` reads the failure trail, and a tool that always
 * returns an empty list is a tool nobody has actually tested. These are the
 * three shapes a real store sees: a card that declined, a buyer who changed
 * their mind, and one who found it cheaper elsewhere — different reasons,
 * which is the point, because "why are we losing orders" is answered by the
 * distribution and not the count.
 */
export const PC_CANCELLATIONS: SeedCancellation[] = [
  {
    daysAgo: 5,
    errorMessage: "Card declined by the issuing bank",
    errorType: "PAYMENT_FAILED",
    recoveryAction: "RETRY_LINK_GENERATED",
    skus: ["GPU-GIGA-4070TIS", "PSU-CORS-RM850X"],
    status: "failed",
  },
  {
    daysAgo: 11,
    errorMessage: "Buyer changed their mind about the case",
    errorType: "ORDER_CANCELLED",
    recoveryAction: "CANCELLED_BY_BUYER",
    skus: ["CSE-FRAC-NORTH"],
    status: "cancelled",
  },
  {
    daysAgo: 18,
    errorMessage: "Card declined by the issuing bank",
    errorType: "PAYMENT_FAILED",
    recoveryAction: "CANCELLED_BY_BUYER",
    skus: ["CPU-INT-I7-14700K", "MBD-ASUS-Z790-PLUS"],
    status: "failed",
  },
  {
    daysAgo: 26,
    errorMessage: "Buyer found the same card cheaper elsewhere",
    errorType: "ORDER_CANCELLED",
    recoveryAction: "CANCELLED_BY_BUYER",
    skus: ["GPU-MSI-4060TI-16"],
    status: "cancelled",
  },
];

/**
 * Historical paid orders, written as SKUs so the intent stays readable.
 *
 * This is not filler. Attach rates, slow movers and cross-sell suggestions are
 * all computed from real `order_items` rows, so without a plausible history
 * the admin agent has nothing true to say. The shape is deliberate:
 *
 *   - A processor is almost always bought with a board. That near-total attach
 *     rate is the baseline everything else is judged against.
 *   - The Peerless Assassin attaches to unlocked processors and to almost
 *     nothing else, which is a real finding rather than a coincidence.
 *   - RGB fans and the walnut case barely attach at all. Those are the
 *     discount candidates §11 asks the admin agent to find, and they have to
 *     be findable from the data rather than asserted in a prompt.
 *   - The imported Arc A750 has sold twice in two months against healthy
 *     stock: the discontinue candidate.
 */
export const PC_ORDER_HISTORY: SeedOrder[] = [
  // Mid-range AM5 gaming builds — the store's bread and butter.
  {
    daysAgo: 2,
    skus: [
      "CPU-AMD-R5-7600",
      "MBD-ASUS-B650M-PLUS",
      "RAM-CORS-32-6000",
      "GPU-ZOT-4060",
      "SSD-WD-SN770-1T",
      "PSU-MSI-A650BN",
      "CSE-DEEP-CH370",
    ],
  },
  {
    daysAgo: 3,
    skus: [
      "CPU-AMD-R5-7600",
      "MBD-ASUS-B650M-PLUS",
      "RAM-KING-16-5600",
      "GPU-SAPP-7600",
      "SSD-WD-SN770-1T",
      "PSU-CLRM-MWE550",
      "CSE-ANT-ICE200",
    ],
  },
  {
    daysAgo: 4,
    skus: [
      "CPU-AMD-R7-7800X3D",
      "MBD-MSI-B650-TMHK",
      "RAM-CORS-32-6000",
      "GPU-ASUS-4070S",
      "SSD-SAMS-990P-1T",
      "PSU-CORS-RM750E",
      "CSE-CORS-4000D",
      "COL-THRM-PA120",
    ],
  },
  {
    daysAgo: 5,
    skus: ["CPU-AMD-R5-7600", "MBD-ASUS-B650M-PLUS", "RAM-CORS-32-6000"],
  },
  {
    daysAgo: 6,
    skus: [
      "CPU-INT-I5-13400F",
      "MBD-MSI-B760M-A",
      "RAM-KING-16-5600",
      "GPU-ZOT-4060",
      "SSD-WD-SN770-1T",
      "PSU-MSI-A650BN",
      "CSE-DEEP-CH370",
    ],
  },
  {
    daysAgo: 7,
    skus: ["GPU-ZOT-4060", "PSU-CORS-RM750E"],
  },
  {
    daysAgo: 8,
    skus: [
      "CPU-INT-I5-14600K",
      "MBD-ASUS-Z790-PLUS",
      "RAM-GSKL-32-6400",
      "GPU-PWRC-7800XT",
      "SSD-SAMS-990P-2T",
      "PSU-CORS-RM850X",
      "CSE-LIAN-L216",
      "COL-THRM-PA120",
    ],
  },
  {
    daysAgo: 9,
    skus: ["CPU-AMD-R5-7600", "MBD-MSI-B650-TMHK", "COL-DEEP-AK400"],
  },
  {
    daysAgo: 10,
    skus: [
      "CPU-AMD-R5-5600",
      "MBD-MSI-B550-A",
      "RAM-CORS-32-3600-D4",
      "GPU-SAPP-7600",
      "SSD-CRUC-MX500-1T",
      "PSU-CLRM-MWE550",
      "CSE-ANT-ICE200",
    ],
  },
  {
    daysAgo: 11,
    skus: ["GPU-ASUS-4070S", "MON-LG-27GP850"],
  },
  {
    daysAgo: 12,
    skus: [
      "CPU-AMD-R7-7800X3D",
      "MBD-MSI-B650-TMHK",
      "RAM-CORS-32-6000",
      "GPU-GIGA-4070TIS",
      "SSD-SAMS-990P-2T",
      "PSU-CORS-RM850X",
      "CSE-LIAN-L216",
      "COL-ARCT-LF3-360",
    ],
  },
  {
    daysAgo: 13,
    skus: ["CPU-INT-I5-13400F", "MBD-GIGA-B760-GX", "RAM-KING-16-5600"],
  },
  {
    daysAgo: 14,
    skus: [
      "CPU-AMD-R5-8600G",
      "MBD-ASUS-B650M-PLUS",
      "RAM-KING-16-5600",
      "SSD-WD-SN770-1T",
      "PSU-MSI-A650BN",
      "CSE-DEEP-CH370",
    ],
  },
  {
    daysAgo: 15,
    skus: ["SSD-SAMS-990P-1T"],
  },
  {
    daysAgo: 16,
    skus: [
      "CPU-INT-I7-14700K",
      "MBD-ASUS-Z790-PLUS",
      "RAM-GSKL-32-6400",
      "GPU-MSI-4080S",
      "SSD-SAMS-990P-2T",
      "PSU-SEAS-GX1000",
      "CSE-LIAN-L216",
      "COL-ARCT-LF3-360",
    ],
  },
  {
    daysAgo: 17,
    skus: ["CPU-AMD-R5-7600", "MBD-ASUS-B650M-PLUS", "GPU-ZOT-4060"],
  },
  {
    daysAgo: 18,
    skus: ["GPU-SAPP-7600", "PSU-MSI-A650BN"],
  },
  {
    daysAgo: 19,
    skus: [
      "CPU-AMD-R5-7600",
      "MBD-MSI-B650-TMHK",
      "RAM-CORS-32-6000",
      "GPU-MSI-4060TI-16",
      "SSD-SAMS-990P-1T",
      "PSU-CORS-RM750E",
      "CSE-NZXT-H5F",
      "COL-DEEP-AK400",
    ],
  },
  {
    daysAgo: 20,
    skus: ["SSD-CRUC-P3P-2T", "HDD-SEAG-BC-2T"],
  },
  {
    daysAgo: 21,
    skus: [
      "CPU-INT-I5-14600K",
      "MBD-GIGA-B760-GX",
      "RAM-KING-16-5600",
      "GPU-ASUS-4070S",
      "SSD-WD-SN770-1T",
      "PSU-CORS-RM750E",
      "CSE-CORS-4000D",
      "COL-THRM-PA120",
    ],
  },
  {
    daysAgo: 22,
    skus: ["MON-DELL-S2721DGF", "PER-LOGI-G502"],
  },
  {
    daysAgo: 23,
    skus: ["CPU-AMD-R5-5600", "MBD-MSI-B550-A", "RAM-CRUC-16-3200-D4"],
  },
  {
    daysAgo: 24,
    skus: [
      "CPU-AMD-R5-7600",
      "MBD-ASRK-B650E-ITX",
      "RAM-CORS-32-6000",
      "GPU-SAPP-7600",
      "SSD-SAMS-990P-1T",
      "PSU-CORS-SF750",
      "CSE-CLRM-NR200P",
      "COL-NOCT-NHL9I",
    ],
  },
  {
    daysAgo: 25,
    skus: ["GPU-ZOT-4060"],
  },
  {
    daysAgo: 26,
    skus: [
      "CPU-INT-I5-13400F",
      "MBD-MSI-B760M-A",
      "RAM-KING-16-5600",
      "GPU-ZOT-4060",
      "SSD-WD-SN770-1T",
      "PSU-MSI-A650BN",
      "CSE-ANT-ICE200",
    ],
  },
  {
    daysAgo: 27,
    skus: ["CPU-AMD-R9-7900X", "MBD-GIGA-X670E-ELITE", "RAM-CORS-64-6000"],
  },
  {
    daysAgo: 28,
    skus: ["SSD-SAMS-990P-2T", "SSD-CRUC-MX500-1T"],
  },
  {
    daysAgo: 30,
    skus: [
      "CPU-AMD-R7-7800X3D",
      "MBD-MSI-B650-TMHK",
      "RAM-CORS-32-6000",
      "GPU-PWRC-7800XT",
      "SSD-SAMS-990P-1T",
      "PSU-CORS-RM850X",
      "CSE-NZXT-H5F",
      "COL-THRM-PA120",
      "FAN-ARCT-P12-5",
    ],
  },
  {
    daysAgo: 32,
    skus: ["MON-SAMS-G5-32", "PER-KEYC-K8P"],
  },
  {
    daysAgo: 33,
    skus: ["CPU-AMD-R5-7600", "MBD-ASUS-B650M-PLUS", "RAM-KING-16-5600"],
  },
  {
    daysAgo: 35,
    skus: [
      "CPU-INT-I5-13400F",
      "MBD-GIGA-B760-GX",
      "RAM-KING-16-5600",
      "GPU-SAPP-7600",
      "SSD-CRUC-P3P-2T",
      "PSU-CLRM-MWE550",
      "CSE-DEEP-CH370",
      "COL-DEEP-AK400",
    ],
  },
  {
    daysAgo: 37,
    skus: ["GPU-INT-A750", "PSU-MSI-A650BN"], // the imported card, first of two
  },
  {
    daysAgo: 38,
    skus: ["MON-ACER-KG241Y", "PER-LOGI-G502", "PER-HYPX-CLD3"],
  },
  {
    daysAgo: 40,
    skus: [
      "CPU-AMD-R5-7600",
      "MBD-MSI-B650-TMHK",
      "RAM-CORS-32-6000",
      "GPU-ZOT-4060",
      "SSD-SAMS-990P-1T",
      "PSU-CORS-RM750E",
      "CSE-CORS-4000D",
      "COL-DEEP-AK400",
      "FAN-LIAN-SL120-3", // the one RGB-fan sale
    ],
  },
  {
    daysAgo: 42,
    skus: ["CPU-AMD-R5-5600", "MBD-MSI-B550-A", "RAM-CORS-32-3600-D4"],
  },
  {
    daysAgo: 44,
    skus: ["SSD-WD-SN770-1T", "HDD-SEAG-BC-2T"],
  },
  {
    daysAgo: 46,
    skus: [
      "CPU-INT-I5-14600K",
      "MBD-ASUS-Z790-PLUS",
      "RAM-GSKL-32-6400",
      "GPU-MSI-4060TI-16",
      "SSD-SAMS-990P-2T",
      "PSU-CORS-RM750E",
      "CSE-FRAC-NORTH", // the one walnut-case sale
      "COL-NOCT-NHD15",
    ],
  },
  {
    daysAgo: 48,
    skus: ["GPU-INT-A750"], // the second, and last, imported card
  },
  {
    daysAgo: 50,
    skus: ["PER-LOGI-C920", "PER-HYPX-CLD3"],
  },
  {
    daysAgo: 52,
    skus: [
      "CPU-AMD-R5-7600",
      "MBD-ASUS-B650M-PLUS",
      "RAM-KING-16-5600",
      "GPU-ZOT-4060",
      "SSD-WD-SN770-1T",
      "PSU-MSI-A650BN",
      "CSE-ANT-ICE200",
      "FAN-ARCT-P12-5",
    ],
  },
  {
    daysAgo: 55,
    skus: ["MON-LG-27GP850", "PER-KEYC-K8P", "PER-LOGI-G502"],
  },
];
