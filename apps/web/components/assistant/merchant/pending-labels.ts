/** What to say while a merchant tool is still running. */
export function merchantPendingLabel(type: string): string {
  switch (type) {
    case "tool-getSalesSummary":
    case "tool-getTopPerformers":
    case "tool-findSlowMovers":
      return "Pulling the numbers…";
    case "tool-getAgentOrderQueue":
      return "Checking the queue…";
    case "tool-draftCampaign":
      return "Drafting a campaign…";
    case "tool-getAuditTrail":
      return "Reading the audit trail…";
    case "tool-getCatalogReadiness":
      return "Checking what an AI buyer can see…";
    case "tool-enrichProduct":
      return "Filling in the catalogue…";
    case "tool-getAgentBuyerActivity":
      return "Looking up your agent buyers…";
    case "tool-getMarginSummary":
      return "Working out what you kept…";
    case "tool-getCampaignPerformance":
      return "Measuring the campaign…";
    default:
      return "Working…";
  }
}
