/**
 * The four machines. Named and written like cars, because a product with no
 * name and no positioning gives a buyer nothing to want.
 */

import { MOCK_PRODUCTS_BY_ID } from "./products";
import type { PrebuiltDetail, ProductSummary } from "./types";

const rupees = (amount: number) => amount * 100;

function part(id: string): ProductSummary {
  const product = MOCK_PRODUCTS_BY_ID.get(id);

  if (!product) {
    throw new Error(`Mock prebuilt references an unknown product: ${id}`);
  }

  return product;
}

const GRAPHITE = { hex: "#1C1C1C", name: "Graphite" };
const BONE = { hex: "#E8E4DE", name: "Bone" };
const LACQUER = { hex: "#8C1226", name: "Lacquer" };

export const MOCK_PREBUILTS: PrebuiltDetail[] = [
  {
    colourways: [GRAPHITE, BONE],
    compareAtPaise: rupees(109_900),
    estimatedWattage: 420,
    features: [
      {
        body: "A six-core chip and a card sized to match it. Nothing here is waiting on anything else, which is why it holds its frame rate instead of spiking.",
        fact: "1080p ultra, 144 fps sustained",
        heading: "Balanced, not bottlenecked",
        imageUrl: "",
      },
      {
        body: "Mesh front, three intake fans, one exhaust. Under a full hour of load it stays under 25 dB at a metre — quiet enough to sit next to.",
        fact: "24 dB(A) at one metre under load",
        heading: "Quiet at the desk",
        imageUrl: "",
      },
    ],
    headlineSpecs: [
      { label: "Processor", value: "Ryzen 5 9600X" },
      { label: "Graphics", value: "RTX 5070 12GB" },
      { label: "Memory", value: "32GB DDR5-6000" },
      { label: "Storage", value: "2TB PCIe 5.0" },
    ],
    heroImageUrl: "",
    images: ["hero", "angle", "front", "inside", "ports", "scale"],
    manifest: [
      { product: part("cpu-2"), slot: "Processor" },
      { product: part("motherboard-1"), slot: "Motherboard" },
      { product: part("ram-1"), slot: "Memory" },
      { product: part("gpu-2"), slot: "Graphics" },
      { product: part("storage-1"), slot: "Storage" },
      { product: part("psu-1"), slot: "Power supply" },
      { product: part("case-1"), slot: "Case" },
      { product: part("cooler-2"), slot: "Cooling" },
    ],
    name: "ARC",
    pricePaise: rupees(99_500),
    psuRatedWattage: 850,
    slug: "arc",
    specGroups: [
      {
        rows: [
          { label: "Socket", value: "AM5" },
          { label: "Chipset", value: "B850" },
          { label: "Cooling", value: "360 mm AIO" },
        ],
        title: "Platform",
      },
      {
        rows: [
          { label: "Warranty", value: "3 years" },
          { label: "Build time", value: "5 working days" },
        ],
        title: "Ownership",
      },
    ],
    tagline: "Everything that matters. Nothing that doesn't.",
    tier: "entry",
    useCases: ["1080p gaming", "First build", "Streaming"],
  },
  {
    colourways: [GRAPHITE, LACQUER, BONE],
    estimatedWattage: 520,
    features: [
      {
        body: "The 9800X3D's cache is the reason competitive titles hold 300-plus at 1440p. This is the part of the machine that decides the round.",
        fact: "312 fps average at 1440p competitive",
        heading: "Frames where they count",
        imageUrl: "",
      },
      {
        body: "One 2.1 cable to a 360 Hz panel, no adapters, no chroma subsampling. The output stack is as fast as the render stack.",
        fact: "DP 2.1 UHBR20 · 360 Hz uncompressed",
        heading: "Straight to the panel",
        imageUrl: "",
      },
    ],
    headlineSpecs: [
      { label: "Processor", value: "Ryzen 7 9800X3D" },
      { label: "Graphics", value: "RTX 5080 16GB" },
      { label: "Memory", value: "32GB DDR5-6000" },
      { label: "Storage", value: "2TB PCIe 5.0" },
    ],
    heroImageUrl: "",
    images: ["hero", "angle", "front", "inside", "ports", "scale"],
    manifest: [
      { product: part("cpu-1"), slot: "Processor" },
      { product: part("motherboard-2"), slot: "Motherboard" },
      { product: part("ram-1"), slot: "Memory" },
      { product: part("gpu-1"), slot: "Graphics" },
      { product: part("storage-1"), slot: "Storage" },
      { product: part("psu-1"), slot: "Power supply" },
      { product: part("case-2"), slot: "Case" },
      { product: part("cooler-2"), slot: "Cooling" },
    ],
    name: "VOLT",
    pricePaise: rupees(194_900),
    psuRatedWattage: 850,
    slug: "volt",
    specGroups: [
      {
        rows: [
          { label: "Socket", value: "AM5" },
          { label: "Chipset", value: "X870E" },
          { label: "Cooling", value: "360 mm AIO" },
        ],
        title: "Platform",
      },
      {
        rows: [
          { label: "Warranty", value: "3 years" },
          { label: "Build time", value: "5 working days" },
        ],
        title: "Ownership",
      },
    ],
    tagline: "Built for the frames that decide the round.",
    tier: "esports",
    useCases: ["1440p high-refresh", "Esports", "Streaming"],
  },
  {
    colourways: [GRAPHITE, BONE, LACQUER],
    compareAtPaise: rupees(359_900),
    estimatedWattage: 780,
    features: [
      {
        body: "A 5090 and a 9800X3D under one loop, with the radiator sized for both. Full load sits at 34 dB — the fans never have to shout.",
        fact: "34 dB(A) at full load",
        heading: "Open-loop, kept quiet",
        imageUrl: "",
      },
      {
        body: "Panoramic glass on two sides, cabling routed behind a shroud, and not one RGB header populated unless you ask for it.",
        fact: "Fits cards up to 440 mm",
        heading: "Nothing on show but hardware",
        imageUrl: "",
      },
      {
        body: "A 1200 W Platinum unit leaves 420 W of headroom over the measured draw. That margin is what keeps transients off the rails.",
        fact: "1200 W supply · 780 W measured draw",
        heading: "Headroom on purpose",
        imageUrl: "",
      },
    ],
    headlineSpecs: [
      { label: "Processor", value: "Ryzen 7 9800X3D" },
      { label: "Graphics", value: "RTX 5090 32GB" },
      { label: "Memory", value: "64GB DDR5-6400" },
      { label: "Storage", value: "4TB PCIe 4.0" },
    ],
    heroImageUrl: "",
    images: ["hero", "angle", "front", "inside", "ports", "scale"],
    manifest: [
      { product: part("cpu-1"), slot: "Processor" },
      { product: part("motherboard-2"), slot: "Motherboard" },
      { product: part("ram-2"), slot: "Memory" },
      { product: part("gpu-4"), slot: "Graphics", state: "needs_verification" },
      { product: part("storage-2"), slot: "Storage" },
      { product: part("psu-2"), slot: "Power supply" },
      { product: part("case-1"), slot: "Case" },
      { product: part("cooler-2"), slot: "Cooling" },
    ],
    name: "MERIDIAN",
    pricePaise: rupees(334_900),
    psuRatedWattage: 1200,
    slug: "meridian",
    specGroups: [
      {
        rows: [
          { label: "Socket", value: "AM5" },
          { label: "Chipset", value: "X870E" },
          { label: "Cooling", value: "360 mm AIO" },
        ],
        title: "Platform",
      },
      {
        rows: [
          { label: "Warranty", value: "3 years" },
          { label: "Build time", value: "7 working days" },
        ],
        title: "Ownership",
      },
    ],
    tagline: "Open-loop performance, kept quiet.",
    tier: "enthusiast",
    useCases: ["4K gaming", "Enthusiast", "VR"],
  },
  {
    colourways: [GRAPHITE, BONE],
    estimatedWattage: 610,
    features: [
      {
        body: "Twenty cores and 64GB means the render finishes in the background while the timeline stays responsive in front of it.",
        fact: "20 cores · 64GB DDR5-6400",
        heading: "Render and keep working",
        imageUrl: "",
      },
      {
        body: "Two NVMe drives on separate lanes: scratch on one, project files on the other, so a long export never fights the cache.",
        fact: "Two NVMe drives on separate PCIe lanes",
        heading: "Two lanes, no queue",
        imageUrl: "",
      },
    ],
    headlineSpecs: [
      { label: "Processor", value: "Core Ultra 7 265K" },
      { label: "Graphics", value: "RTX 5080 16GB" },
      { label: "Memory", value: "64GB DDR5-6400" },
      { label: "Storage", value: "4TB PCIe 4.0" },
    ],
    heroImageUrl: "",
    images: ["hero", "angle", "front", "inside", "ports", "scale"],
    manifest: [
      { product: part("cpu-3"), slot: "Processor" },
      { product: part("motherboard-1"), slot: "Motherboard" },
      { product: part("ram-2"), slot: "Memory" },
      { product: part("gpu-1"), slot: "Graphics" },
      { product: part("storage-2"), slot: "Storage" },
      { product: part("psu-2"), slot: "Power supply" },
      { product: part("case-1"), slot: "Case" },
      { product: part("cooler-1"), slot: "Cooling" },
    ],
    name: "FORGE",
    pricePaise: rupees(268_900),
    psuRatedWattage: 1200,
    slug: "forge",
    specGroups: [
      {
        rows: [
          { label: "Socket", value: "LGA 1851" },
          { label: "Chipset", value: "B850" },
          { label: "Cooling", value: "Dual tower air" },
        ],
        title: "Platform",
      },
      {
        rows: [
          { label: "Warranty", value: "3 years" },
          { label: "Build time", value: "7 working days" },
        ],
        title: "Ownership",
      },
    ],
    tagline: "Rendered, encoded, and back to work.",
    tier: "creator",
    useCases: ["Content creation", "Workstation", "3D and CAD"],
  },
];

export const MOCK_PREBUILTS_BY_SLUG = new Map(
  MOCK_PREBUILTS.map((prebuilt) => [prebuilt.slug, prebuilt])
);
