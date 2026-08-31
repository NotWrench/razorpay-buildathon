import type { CompatibilityRule } from "../types";
import { buildCompleteness } from "./completeness";
import {
  coolerCaseClearance,
  coolerCpuSocket,
  gpuCaseClearance,
} from "./physical";
import {
  cpuMotherboardSocket,
  motherboardCaseFormFactor,
  motherboardRamSlots,
  motherboardRamType,
} from "./platform";
import { psuGpuConnectors, psuWattageHeadroom } from "./power";
import { storageInterfaceSlots } from "./storage";

/**
 * Every rule, in the order a person would check them.
 *
 * Platform first, because a socket mismatch makes the rest moot; then fit,
 * then power, then whether the build is finished at all. The order is only
 * presentational — the rules are independent and none reads another's output.
 */
export const RULES: { name: string; run: CompatibilityRule }[] = [
  { name: "cpu_motherboard_socket", run: cpuMotherboardSocket },
  { name: "motherboard_ram_type", run: motherboardRamType },
  { name: "motherboard_ram_slots", run: motherboardRamSlots },
  { name: "motherboard_case_form_factor", run: motherboardCaseFormFactor },
  { name: "gpu_case_clearance", run: gpuCaseClearance },
  { name: "cooler_case_clearance", run: coolerCaseClearance },
  { name: "cooler_cpu_socket", run: coolerCpuSocket },
  { name: "psu_wattage_headroom", run: psuWattageHeadroom },
  { name: "psu_gpu_connectors", run: psuGpuConnectors },
  { name: "storage_interface_slots", run: storageInterfaceSlots },
  { name: "build_completeness", run: buildCompleteness },
];

export { buildCompleteness, slotsUsed } from "./completeness";
export {
  coolerCaseClearance,
  coolerCpuSocket,
  gpuCaseClearance,
} from "./physical";
export {
  cpuMotherboardSocket,
  motherboardCaseFormFactor,
  motherboardRamSlots,
  motherboardRamType,
} from "./platform";
export {
  BASE_SYSTEM_WATTS,
  estimateWattage,
  PSU_HEADROOM_FACTOR,
  psuGpuConnectors,
  psuWattageHeadroom,
  recommendPsuWattage,
  type WattageEstimate,
} from "./power";
export { storageInterfaceSlots } from "./storage";
