import type { BuildComponent, ComponentSpecs } from "../src/index";

/**
 * Parts, taken from the real seed catalog.
 *
 * Copies rather than database reads, so the suite runs with nothing else up —
 * but copies of parts that actually exist in the store, so a rule that passes
 * here passes on the demo too. Made-up fixtures would let the engine and the
 * catalog drift apart silently, which is the failure mode this whole phase
 * exists to prevent.
 */

let counter = 0;

function part(
  categorySlug: BuildComponent["categorySlug"],
  name: string,
  specs: ComponentSpecs | null,
  quantity = 1
): BuildComponent {
  counter += 1;

  return {
    categorySlug,
    name,
    productId: `p${counter}`,
    quantity,
    specs,
  };
}

// ------------------------------------------------------------- processors
export const ryzen7600 = part("cpu", "AMD Ryzen 5 7600", {
  memoryType: "DDR5",
  socket: "AM5",
  tdpWatts: 65,
});

export const ryzen7900x = part("cpu", "AMD Ryzen 9 7900X", {
  memoryType: "DDR5",
  socket: "AM5",
  tdpWatts: 170,
});

export const ryzen5600 = part("cpu", "AMD Ryzen 5 5600", {
  memoryType: "DDR4",
  socket: "AM4",
  tdpWatts: 65,
});

export const core13400f = part("cpu", "Intel Core i5-13400F", {
  memoryType: "DDR5",
  socket: "LGA1700",
  tdpWatts: 148,
});

/** A processor whose socket nobody entered. */
export const cpuWithoutSocket = part("cpu", "Unlisted Processor", {
  tdpWatts: 65,
});

/** A processor with no spec row at all — a different fact from a null column. */
export const cpuWithoutSpecs = part("cpu", "Unspecified Processor", null);

// ------------------------------------------------------------ motherboards
export const b650mPlus = part("motherboard", "ASUS TUF Gaming B650M-PLUS", {
  chipset: "B650",
  formFactor: "mATX",
  m2Slots: 2,
  memorySlots: 4,
  memorySpeedMhz: 6400,
  memoryType: "DDR5",
  sataPorts: 4,
  socket: "AM5",
});

export const b650Tomahawk = part("motherboard", "MSI MAG B650 Tomahawk WiFi", {
  chipset: "B650",
  formFactor: "ATX",
  m2Slots: 3,
  memorySlots: 4,
  memorySpeedMhz: 6400,
  memoryType: "DDR5",
  sataPorts: 6,
  socket: "AM5",
});

export const b650eItx = part("motherboard", "ASRock B650E PG-ITX WiFi", {
  chipset: "B650E",
  formFactor: "ITX",
  m2Slots: 2,
  memorySlots: 2,
  memorySpeedMhz: 6600,
  memoryType: "DDR5",
  sataPorts: 4,
  socket: "AM5",
});

export const b550a = part("motherboard", "MSI PRO B550-A", {
  chipset: "B550",
  formFactor: "ATX",
  m2Slots: 2,
  memorySlots: 4,
  memorySpeedMhz: 4400,
  memoryType: "DDR4",
  sataPorts: 6,
  socket: "AM4",
});

// ------------------------------------------------------------------ memory
export const ddr5Kit32 = part("ram", "Corsair Vengeance 32GB DDR5-6000", {
  memoryCapacityGb: 32,
  memorySlots: 2,
  memorySpeedMhz: 6000,
  memoryType: "DDR5",
});

export const ddr5Kit16 = part("ram", "Kingston Fury Beast 16GB DDR5-5600", {
  memoryCapacityGb: 16,
  memorySlots: 2,
  memorySpeedMhz: 5600,
  memoryType: "DDR5",
});

export const ddr4Kit32 = part("ram", "Corsair Vengeance LPX 32GB DDR4-3600", {
  memoryCapacityGb: 32,
  memorySlots: 2,
  memorySpeedMhz: 3600,
  memoryType: "DDR4",
});

// ---------------------------------------------------------- graphics cards
export const rtx4060 = part("gpu", "Zotac RTX 4060 Twin Edge", {
  lengthMm: 224,
  memoryCapacityGb: 8,
  pciePowerConnectors: [{ count: 1, pins: 8 }],
  recommendedPsuWatts: 550,
  tdpWatts: 115,
});

export const rtx4070TiSuper = part(
  "gpu",
  "Gigabyte RTX 4070 Ti SUPER Gaming OC",
  {
    lengthMm: 336,
    memoryCapacityGb: 16,
    pciePowerConnectors: [{ count: 3, pins: 8 }],
    recommendedPsuWatts: 700,
    tdpWatts: 285,
  }
);

export const rtx4080Super = part("gpu", "MSI RTX 4080 SUPER Suprim X", {
  lengthMm: 358,
  memoryCapacityGb: 16,
  pciePowerConnectors: [{ count: 3, pins: 8 }],
  recommendedPsuWatts: 850,
  tdpWatts: 320,
});

/** The imported card: no published length, no published connector layout. */
export const arcA750 = part("gpu", "Intel Arc A750 (imported)", {
  memoryCapacityGb: 8,
  recommendedPsuWatts: 600,
  tdpWatts: 225,
});

// ----------------------------------------------------------------- storage
export const nvme1tb = part("storage", "WD Black SN770 1TB", {
  storageInterface: "M.2 NVMe",
});

export const nvme2tb = part("storage", "Samsung 990 PRO 2TB", {
  storageInterface: "M.2 NVMe",
});

export const sataSsd = part("storage", "Crucial MX500 1TB SATA", {
  storageInterface: "SATA",
});

// ---------------------------------------------------------- power supplies
export const psu650 = part("psu", "MSI MAG A650BN 650W Bronze", {
  formFactor: "ATX",
  pciePowerConnectors: [{ count: 2, pins: 8 }],
  psuWattage: 650,
});

export const psu850 = part("psu", "Corsair RM850x 850W Gold", {
  formFactor: "ATX",
  pciePowerConnectors: [{ count: 6, pins: 8 }],
  psuWattage: 850,
});

export const psu450 = part("psu", "Antec CSK 450 450W", {
  formFactor: "ATX",
  pciePowerConnectors: [{ count: 1, pins: 8 }],
  psuWattage: 450,
});

// ------------------------------------------------------------------- cases
export const caseCh370 = part("case", "Deepcool CH370", {
  formFactor: "mATX",
  maxCoolerHeightMm: 165,
  maxGpuLengthMm: 320,
});

export const caseIce200 = part("case", "Ant Esports ICE-200TG", {
  formFactor: "mATX",
  maxCoolerHeightMm: 160,
  maxGpuLengthMm: 300,
});

export const caseNr200p = part("case", "Cooler Master NR200P", {
  formFactor: "ITX",
  maxCoolerHeightMm: 155,
  maxGpuLengthMm: 330,
});

export const caseLancool216 = part("case", "Lian Li Lancool 216", {
  formFactor: "ATX",
  maxCoolerHeightMm: 180,
  maxGpuLengthMm: 392,
});

// ----------------------------------------------------------------- coolers
export const ak400 = part("cooler", "DeepCool AK400", {
  heightMm: 155,
  socket: "AM5,AM4,LGA1700,LGA1200",
  tdpWatts: 220,
});

export const nhd15 = part("cooler", "Noctua NH-D15", {
  heightMm: 165,
  socket: "AM5,AM4,LGA1700",
  tdpWatts: 250,
});

export const hyper212 = part("cooler", "Cooler Master Hyper 212 Black", {
  heightMm: 159,
  socket: "AM4,LGA1700,LGA1200",
  tdpWatts: 150,
});

// -------------------------------------------------------------------- fans
export const arcticP12 = part("fan", "Arctic P12 PWM PST 5-pack", {});

/**
 * The ₹77,493 build from §29 — every slot filled, every rule satisfied.
 *
 * This is the build the demo is meant to arrive at, so if the suite has one
 * fixture that must stay green, it is this one.
 */
export const goodBuild: BuildComponent[] = [
  ryzen7600,
  b650mPlus,
  ddr5Kit16,
  rtx4060,
  nvme1tb,
  psu650,
  caseCh370,
];

/** The same build with an AM4 processor on the AM5 board. */
export const socketMismatchBuild: BuildComponent[] = [
  ryzen5600,
  b650mPlus,
  ddr5Kit16,
  rtx4060,
  nvme1tb,
  psu650,
  caseCh370,
];

/** A 358mm card in a 300mm case. */
export const oversizedGpuBuild: BuildComponent[] = [
  ryzen7600,
  b650mPlus,
  ddr5Kit16,
  rtx4080Super,
  nvme1tb,
  psu850,
  caseIce200,
];

/** The imported card: no length, no connectors, and a processor with no specs. */
export const missingSpecsBuild: BuildComponent[] = [
  cpuWithoutSpecs,
  b650mPlus,
  ddr5Kit16,
  arcA750,
  nvme1tb,
  psu650,
  caseCh370,
];
