import { describe, expect, test } from "bun:test";
import {
  type CompatibilityIssue,
  coolerCaseClearance,
  coolerCpuSocket,
  cpuMotherboardSocket,
  estimateWattage,
  gpuCaseClearance,
  motherboardCaseFormFactor,
  motherboardRamSlots,
  motherboardRamType,
  psuGpuConnectors,
  psuWattageHeadroom,
  recommendPsuWattage,
  storageInterfaceSlots,
} from "../src/index";
import * as f from "./fixtures";

/**
 * A test per rule, and for each rule the three answers that matter: it passes,
 * it fails, and it cannot tell.
 *
 * The third is the one worth the effort. `insufficient_data` is the state §4
 * adds over an ordinary boolean check, and a rule that quietly returns
 * `compatible` on a null would pass every other test in this file.
 */

/** The single finding a rule produced, or a failure if it produced none. */
function only(issues: CompatibilityIssue[]): CompatibilityIssue {
  expect(issues).toHaveLength(1);

  return issues[0] as CompatibilityIssue;
}

describe("cpu_motherboard_socket", () => {
  test("matching sockets are compatible", () => {
    const issue = only(cpuMotherboardSocket([f.ryzen7600, f.b650mPlus]));

    expect(issue.status).toBe("compatible");
    expect(issue.severity).toBe("info");
  });

  test("an AM4 processor on an AM5 board is incompatible", () => {
    const issue = only(cpuMotherboardSocket([f.ryzen5600, f.b650mPlus]));

    expect(issue.status).toBe("incompatible");
    expect(issue.severity).toBe("blocking");
    expect(issue.message).toContain("AM4");
    expect(issue.message).toContain("AM5");
  });

  test("a missing socket is insufficient_data, not compatible", () => {
    const issue = only(cpuMotherboardSocket([f.cpuWithoutSocket, f.b650mPlus]));

    expect(issue.status).toBe("insufficient_data");
    expect(issue.missingSpecs).toContain("Unlisted Processor.socket");
  });

  test("no spec row at all is also insufficient_data", () => {
    const issue = only(cpuMotherboardSocket([f.cpuWithoutSpecs, f.b650mPlus]));

    expect(issue.status).toBe("insufficient_data");
  });

  test("nothing to compare produces no finding", () => {
    expect(cpuMotherboardSocket([f.b650mPlus])).toHaveLength(0);
  });
});

describe("motherboard_ram_type", () => {
  test("DDR5 in a DDR5 board is compatible", () => {
    expect(only(motherboardRamType([f.b650mPlus, f.ddr5Kit32])).status).toBe(
      "compatible"
    );
  });

  test("a DDR4 kit against a DDR5 board is incompatible", () => {
    const issue = only(motherboardRamType([f.b650mPlus, f.ddr4Kit32]));

    expect(issue.status).toBe("incompatible");
    expect(issue.suggestion).toContain("DDR5");
  });

  test("a DDR4 kit in a DDR4 board is compatible", () => {
    expect(only(motherboardRamType([f.b550a, f.ddr4Kit32])).status).toBe(
      "compatible"
    );
  });

  test("an unstated generation is insufficient_data", () => {
    const kit = { ...f.ddr5Kit32, specs: { memorySlots: 2 } };

    expect(only(motherboardRamType([f.b650mPlus, kit])).status).toBe(
      "insufficient_data"
    );
  });
});

describe("motherboard_ram_slots", () => {
  test("one two-stick kit fits a four-slot board", () => {
    const issue = only(motherboardRamSlots([f.b650mPlus, f.ddr5Kit32]));

    expect(issue.status).toBe("compatible");
    expect(issue.message).toContain("2 of");
  });

  test("two two-stick kits do not fit a two-slot board", () => {
    const issue = only(
      motherboardRamSlots([f.b650eItx, { ...f.ddr5Kit32, quantity: 2 }])
    );

    expect(issue.status).toBe("incompatible");
    expect(issue.message).toContain("4 slots");
  });

  test("quantity is counted, not just the number of line items", () => {
    const issue = only(
      motherboardRamSlots([f.b650mPlus, { ...f.ddr5Kit32, quantity: 3 }])
    );

    expect(issue.status).toBe("incompatible");
  });

  test("an unstated slot count is insufficient_data", () => {
    const board = { ...f.b650mPlus, specs: { socket: "AM5" } };

    expect(only(motherboardRamSlots([board, f.ddr5Kit32])).status).toBe(
      "insufficient_data"
    );
  });

  test("no memory selected produces no finding", () => {
    expect(motherboardRamSlots([f.b650mPlus])).toHaveLength(0);
  });
});

describe("motherboard_case_form_factor", () => {
  test("a micro-ATX board in a micro-ATX case is compatible", () => {
    expect(
      only(motherboardCaseFormFactor([f.b650mPlus, f.caseCh370])).status
    ).toBe("compatible");
  });

  test("a smaller board in a larger case is compatible", () => {
    expect(
      only(motherboardCaseFormFactor([f.b650eItx, f.caseLancool216])).status
    ).toBe("compatible");
  });

  test("an ATX board in an ITX case is incompatible", () => {
    const issue = only(
      motherboardCaseFormFactor([f.b650Tomahawk, f.caseNr200p])
    );

    expect(issue.status).toBe("incompatible");
    expect(issue.message).toContain("ATX");
  });

  test("an unstated form factor is insufficient_data", () => {
    const enclosure = { ...f.caseCh370, specs: { maxGpuLengthMm: 320 } };

    expect(
      only(motherboardCaseFormFactor([f.b650mPlus, enclosure])).status
    ).toBe("insufficient_data");
  });
});

describe("gpu_case_clearance", () => {
  test("a short card in a roomy case is compatible", () => {
    const issue = only(gpuCaseClearance([f.rtx4060, f.caseCh370]));

    expect(issue.status).toBe("compatible");
    expect(issue.message).toContain("96mm to spare");
  });

  test("a 358mm card in a 300mm case is incompatible", () => {
    const issue = only(gpuCaseClearance([f.rtx4080Super, f.caseIce200]));

    expect(issue.status).toBe("incompatible");
    expect(issue.severity).toBe("blocking");
  });

  test("clearing by under 5mm asks the customer to measure", () => {
    const card = { ...f.rtx4060, specs: { ...f.rtx4060.specs, lengthMm: 318 } };
    const issue = only(gpuCaseClearance([card, f.caseCh370]));

    expect(issue.status).toBe("requires_verification");
    expect(issue.severity).toBe("warning");
  });

  test("an exact fit still asks the customer to measure", () => {
    const card = { ...f.rtx4060, specs: { ...f.rtx4060.specs, lengthMm: 320 } };

    expect(only(gpuCaseClearance([card, f.caseCh370])).status).toBe(
      "requires_verification"
    );
  });

  test("a card with no published length is insufficient_data", () => {
    const issue = only(gpuCaseClearance([f.arcA750, f.caseCh370]));

    expect(issue.status).toBe("insufficient_data");
    expect(issue.missingSpecs).toContain("Intel Arc A750 (imported).lengthMm");
  });
});

describe("cooler_case_clearance", () => {
  test("a 155mm cooler under a 165mm limit is compatible", () => {
    expect(only(coolerCaseClearance([f.ak400, f.caseCh370])).status).toBe(
      "compatible"
    );
  });

  test("a 165mm cooler in a 155mm case is incompatible", () => {
    const issue = only(coolerCaseClearance([f.nhd15, f.caseNr200p]));

    expect(issue.status).toBe("incompatible");
    expect(issue.message).toContain("side panel");
  });

  test("an unstated clearance is insufficient_data", () => {
    const enclosure = { ...f.caseCh370, specs: { formFactor: "mATX" } };

    expect(only(coolerCaseClearance([f.ak400, enclosure])).status).toBe(
      "insufficient_data"
    );
  });
});

describe("cooler_cpu_socket", () => {
  test("a cooler listing the socket mounts", () => {
    expect(only(coolerCpuSocket([f.ak400, f.ryzen7600])).status).toBe(
      "compatible"
    );
  });

  test("a cooler with no AM5 bracket is incompatible", () => {
    const issue = only(coolerCpuSocket([f.hyper212, f.ryzen7600]));

    expect(issue.status).toBe("incompatible");
    expect(issue.message).toContain("AM4");
  });

  test("the same cooler mounts on the socket it does list", () => {
    expect(only(coolerCpuSocket([f.hyper212, f.core13400f])).status).toBe(
      "compatible"
    );
  });

  test("an unstated socket is insufficient_data", () => {
    expect(only(coolerCpuSocket([f.ak400, f.cpuWithoutSocket])).status).toBe(
      "insufficient_data"
    );
  });
});

describe("psu_wattage_headroom", () => {
  test("a supply with comfortable headroom is compatible", () => {
    expect(
      only(psuWattageHeadroom([f.ryzen7600, f.rtx4060, f.psu650])).status
    ).toBe("compatible");
  });

  test("a supply under the expected draw is incompatible", () => {
    const issue = only(
      psuWattageHeadroom([f.ryzen7900x, f.rtx4070TiSuper, f.psu450])
    );

    expect(issue.status).toBe("incompatible");
    expect(issue.severity).toBe("blocking");
    expect(issue.suggestion).toContain("W");
  });

  test("a supply above the draw but inside the margin asks for a check", () => {
    // 170 + 285 + 60 base = 515W drawn, 670W wanted at 1.3x.
    const issue = only(
      psuWattageHeadroom([f.ryzen7900x, f.rtx4070TiSuper, f.psu650])
    );

    expect(issue.status).toBe("requires_verification");
    expect(issue.severity).toBe("warning");
  });

  test("an unpublished draw is insufficient_data", () => {
    const issue = only(
      psuWattageHeadroom([f.cpuWithoutSpecs, f.rtx4060, f.psu650])
    );

    expect(issue.status).toBe("insufficient_data");
    expect(issue.missingSpecs).toContain("Unspecified Processor.tdpWatts");
  });

  test("no supply selected produces no finding", () => {
    expect(psuWattageHeadroom([f.ryzen7600, f.rtx4060])).toHaveLength(0);
  });
});

describe("psu_gpu_connectors", () => {
  test("a supply with enough cables is compatible", () => {
    expect(only(psuGpuConnectors([f.psu650, f.rtx4060])).status).toBe(
      "compatible"
    );
  });

  test("one 8-pin against a card needing three is incompatible", () => {
    const issue = only(psuGpuConnectors([f.psu450, f.rtx4080Super]));

    expect(issue.status).toBe("incompatible");
    expect(issue.message).toContain("3 x 8-pin needed, 1 provided");
  });

  test("wattage headroom does not excuse missing cables", () => {
    const supply = {
      ...f.psu850,
      specs: {
        ...f.psu850.specs,
        pciePowerConnectors: [{ count: 2, pins: 8 }],
      },
    };

    expect(only(psuGpuConnectors([supply, f.rtx4080Super])).status).toBe(
      "incompatible"
    );
  });

  test("an unpublished connector layout is insufficient_data", () => {
    const issue = only(psuGpuConnectors([f.psu650, f.arcA750]));

    expect(issue.status).toBe("insufficient_data");
  });

  test("no card selected produces no finding", () => {
    expect(psuGpuConnectors([f.psu650])).toHaveLength(0);
  });
});

describe("storage_interface_slots", () => {
  test("two NVMe drives fit a two-slot board", () => {
    const issue = only(
      storageInterfaceSlots([f.b650mPlus, f.nvme1tb, f.nvme2tb])
    );

    expect(issue.status).toBe("compatible");
    expect(issue.message).toContain("2/2 M.2");
  });

  test("three NVMe drives do not", () => {
    const issue = only(
      storageInterfaceSlots([
        f.b650mPlus,
        f.nvme1tb,
        f.nvme2tb,
        { ...f.nvme1tb, name: "Third drive", productId: "extra" },
      ])
    );

    expect(issue.status).toBe("incompatible");
    expect(issue.message).toContain("3 M.2 drives");
  });

  test("the interfaces are counted separately", () => {
    // Two M.2 fills the board's slots; a SATA drive still has somewhere to go.
    expect(
      only(
        storageInterfaceSlots([f.b650mPlus, f.nvme1tb, f.nvme2tb, f.sataSsd])
      ).status
    ).toBe("compatible");
  });

  test("an unstated interface is insufficient_data", () => {
    const drive = { ...f.nvme1tb, specs: {} };

    expect(only(storageInterfaceSlots([f.b650mPlus, drive])).status).toBe(
      "insufficient_data"
    );
  });

  test("no drives selected produces no finding", () => {
    expect(storageInterfaceSlots([f.b650mPlus])).toHaveLength(0);
  });
});

describe("estimateWattage", () => {
  test("sums processors and cards over the base allowance", () => {
    expect(estimateWattage([f.ryzen7600, f.rtx4060]).watts).toBe(240);
  });

  test("a cooler's rating is heat removed, not power drawn", () => {
    const withCooler = estimateWattage([f.ryzen7600, f.rtx4060, f.nhd15]).watts;

    expect(withCooler).toBe(240);
  });

  test("drives and fans add their allowance", () => {
    expect(
      estimateWattage([f.ryzen7600, f.rtx4060, f.nvme1tb, f.arcticP12]).watts
    ).toBe(251);
  });

  test("names the parts whose draw is unknown", () => {
    const estimate = estimateWattage([f.cpuWithoutSpecs, f.rtx4060]);

    expect(estimate.missingSpecs).toContain("Unspecified Processor.tdpWatts");
  });
});

describe("recommendPsuWattage", () => {
  test("takes the vendor figure when it is higher than the estimate", () => {
    // 240W x 1.3 = 312W, against the card's own 550W recommendation.
    expect(recommendPsuWattage([f.ryzen7600, f.rtx4060])).toBe(550);
  });

  test("takes the estimate when it is higher, rounded to how supplies sell", () => {
    // 320 + 253 + 60 = 633W drawn, 823W at 1.3x, against a 850W vendor figure.
    const watts = recommendPsuWattage([
      {
        ...f.ryzen7600,
        name: "hot cpu",
        specs: { socket: "AM5", tdpWatts: 253 },
      },
      f.rtx4080Super,
    ]);

    expect(watts).toBe(850);
    expect(watts % 50).toBe(0);
  });
});
