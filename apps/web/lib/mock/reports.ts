/**
 * A compatibility report and the manager's findings.
 *
 * The report is deliberately not clean: a 5090 behind an 850 W unit is the
 * exact case the four-state engine exists for, and the UI needs a failing
 * check to render.
 */

import type { CompatibilityReport, Finding } from "./types";

export const MOCK_COMPATIBILITY: CompatibilityReport = {
  checks: [
    {
      label: "Socket",
      message: "Ryzen 7 9800X3D fits the AM5 socket on the MPG X870E Carbon.",
      relatedProductIds: ["cpu-1", "motherboard-2"],
      rule: "cpu_socket",
      state: "compatible",
    },
    {
      label: "Memory",
      message: "DDR5-6400 is on the board's qualified list at two modules.",
      relatedProductIds: ["ram-2", "motherboard-2"],
      rule: "memory_type",
      state: "compatible",
    },
    {
      label: "Power headroom",
      message:
        "The build draws an estimated 780 W. An 850 W unit leaves 70 W of headroom, under the 150 W this engine requires for transient spikes.",
      relatedProductIds: ["gpu-4", "psu-1"],
      rule: "psu_headroom",
      state: "incompatible",
    },
    {
      label: "GPU clearance",
      message:
        "The card measures 358 mm; the case takes 440 mm with the front fans fitted.",
      relatedProductIds: ["gpu-4", "case-1"],
      rule: "gpu_clearance",
      state: "compatible",
    },
    {
      label: "Cooler height",
      message:
        "No height figure is published for this cooler and case pairing. Worth confirming before you order.",
      relatedProductIds: ["cooler-2", "case-1"],
      rule: "cooler_clearance",
      state: "insufficient_data",
    },
  ],
  estimatedWattage: 780,
  overall: "incompatible",
  psuRatedWattage: 850,
};

export const MOCK_FINDINGS: Finding[] = [
  {
    action: "Reorder 20 units before the weekend.",
    evidence: [
      { label: "Sold", value: "14 units" },
      { label: "On hand", value: "3 units" },
      { label: "Lead time", value: "9 days" },
    ],
    headline: "The RX 9070 XT will be out of stock by Friday.",
    id: "finding-1",
    proposedAction: { kind: "reorder", label: "Draft a reorder" },
    urgency: "high",
    window: "Last 14 days",
  },
  {
    action: "Cut ₹4,000 or move it off the landing page.",
    evidence: [
      { label: "Views", value: "612" },
      { label: "Carts", value: "34" },
      { label: "Orders", value: "2" },
    ],
    headline: "The UltraGear 27GX790A is seen constantly and bought twice.",
    id: "finding-2",
    proposedAction: { kind: "discount", label: "Propose a discount" },
    urgency: "medium",
    window: "Last 30 days",
  },
  {
    action: "Give it a row on the storage category page.",
    evidence: [
      { label: "Views", value: "18" },
      { label: "On hand", value: "26 units" },
      { label: "Tied up", value: "₹7,64,400" },
    ],
    headline: "Nobody has found the SN850X 4TB since it was listed.",
    id: "finding-3",
    proposedAction: { kind: "dismiss", label: "Not worth acting on" },
    urgency: "low",
    window: "Last 30 days",
  },
];
