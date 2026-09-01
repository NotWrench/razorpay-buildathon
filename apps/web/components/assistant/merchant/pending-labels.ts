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
    default:
      return "Working…";
  }
}
