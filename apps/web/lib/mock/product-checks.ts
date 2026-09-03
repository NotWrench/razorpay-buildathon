/**
 * What the compatibility engine would say about one part against the open
 * build.
 *
 * Every check names a rule, so the page can never render a verdict the engine
 * did not give. The interesting case is deliberately the failing one: a 575 W
 * card behind an 850 W supply is exactly why the four-state engine exists, and
 * it is the case the product page has to look good doing.
 */

import { MOCK_PRODUCTS_BY_ID } from "./products";
import type { CompatibilityReport, ProductSummary } from "./types";

/** Parts already chosen in the open build, by the slot they fill. */
const BUILD_PARTS = {
  cooler: "cooler-2",
  cpu: "cpu-1",
  motherboard: "motherboard-2",
  psu: "psu-1",
  ram: "ram-1",
} as const;

const PSU = MOCK_PRODUCTS_BY_ID.get(BUILD_PARTS.psu);
const BOARD = MOCK_PRODUCTS_BY_ID.get(BUILD_PARTS.motherboard);

/** The build's draw without a graphics card, in watts. */
const BASE_DRAW = 205;

/** What the engine insists on keeping free for transient spikes. */
const HEADROOM = 150;

function boardWattage(product: ProductSummary) {
  const spec = product.keySpecs.find((row) => row.label === "Board power");

  return spec ? Number.parseInt(spec.value, 10) : null;
}

function powerCheck(product: ProductSummary): CompatibilityReport["checks"] {
  const draw = boardWattage(product);

  if (draw === null || !PSU) {
    return [];
  }

  const supply = 850;
  const estimated = BASE_DRAW + draw;
  const spare = supply - estimated;

  if (spare >= HEADROOM) {
    return [
      {
        label: "Power headroom",
        message: `The build draws about ${estimated} W. The ${PSU.name} leaves ${spare} W spare.`,
        relatedProductIds: [product.id, PSU.id],
        rule: "psu_headroom",
        state: "compatible",
      },
    ];
  }

  return [
    {
      label: "Power headroom",
      message: `Needs a ${Math.ceil((estimated + HEADROOM) / 50) * 50} W supply. The ${PSU.name} is ${supply} W, which leaves ${spare} W for transients.`,
      relatedProductIds: [product.id, PSU.id],
      rule: "psu_headroom",
      state: "incompatible",
    },
  ];
}

function socketCheck(product: ProductSummary): CompatibilityReport["checks"] {
  if (product.category !== "cpu" || !BOARD) {
    return [];
  }

  const socket = product.keySpecs.find((row) => row.label === "Socket")?.value;
  const fits = socket === "AM5";

  return [
    {
      label: "Socket",
      message: fits
        ? `${socket} matches the ${BOARD.name} already in the build.`
        : `This is an ${socket} chip. The ${BOARD.name} in the build is AM5.`,
      relatedProductIds: [product.id, BOARD.id],
      rule: "cpu_socket",
      state: fits ? "compatible" : "incompatible",
    },
  ];
}

function clearanceCheck(
  product: ProductSummary
): CompatibilityReport["checks"] {
  if (product.category !== "gpu") {
    return [];
  }

  return [
    {
      label: "Card clearance",
      message:
        "No length is published for this card, so the fit against the case is unconfirmed.",
      relatedProductIds: [product.id],
      rule: "gpu_clearance",
      state: "insufficient_data",
    },
  ];
}

function stockCheck(product: ProductSummary): CompatibilityReport["checks"] {
  if (product.stock === "in_stock") {
    return [];
  }

  return [
    {
      label: "Availability",
      message:
        product.stock === "out_of_stock"
          ? "Out of stock. The build cannot be ordered with this part in it."
          : "Low stock — worth confirming before the rest of the build is ordered.",
      relatedProductIds: [product.id],
      rule: "stock",
      state:
        product.stock === "out_of_stock"
          ? "incompatible"
          : "needs_verification",
    },
  ];
}

const WORST: CompatibilityReport["overall"][] = [
  "compatible",
  "insufficient_data",
  "needs_verification",
  "incompatible",
];

/**
 * A report for one part, or nothing at all.
 *
 * Categories that are not build components have no build to be checked
 * against, and inventing checks for a monitor would be a verdict the engine
 * never gave.
 */
export function checkAgainstBuild(
  product: ProductSummary
): CompatibilityReport | undefined {
  const buildable = !(
    product.category === "monitor" || product.category === "peripheral"
  );

  if (!buildable) {
    return;
  }

  const checks = [
    ...socketCheck(product),
    ...powerCheck(product),
    ...clearanceCheck(product),
    ...stockCheck(product),
  ];

  if (checks.length === 0) {
    checks.push({
      label: "Fit",
      message: "Nothing in the build conflicts with this part.",
      relatedProductIds: [product.id],
      rule: "build_fit",
      state: "compatible",
    });
  }

  const overall = checks.reduce<CompatibilityReport["overall"]>(
    (worst, check) =>
      WORST.indexOf(check.state) > WORST.indexOf(worst) ? check.state : worst,
    "compatible"
  );

  const draw = boardWattage(product);

  return {
    checks,
    estimatedWattage: draw === null ? undefined : BASE_DRAW + draw,
    overall,
    psuRatedWattage: 850,
  };
}
