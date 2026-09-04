export * from "./agents";
export {
  type AttachRate,
  getAttachRates,
  getFrequentlyBoughtWith,
  getPaymentHealth,
  getPendingAgentOrders,
  getProductPerformance,
  getSalesSummary,
  getSlowMovers,
  type PaymentHealth,
  type ProductPerformance,
  type SalesSummary,
} from "./analytics";
export {
  AuditAction,
  type AuditActionName,
  auditActorType,
  RecoveryAction,
  recordAudit,
  recordFailure,
} from "./audit";
export {
  assembleBuild,
  type AssembledBuild,
  type AssembledSlot,
  type BuildUpgrade,
  type Candidate,
} from "./build-assembly";
export {
  type CatalogEntry,
  type CatalogScope,
  describeCatalogScope,
  getProductById,
  listActiveProducts,
  type ProductSearchInput,
  type ProductSearchResult,
  type ScoredProduct,
  searchCatalog,
  toCatalogEntry,
  toModelProduct,
} from "./catalog";
export {
  type ComparisonResult,
  type ComparisonRow,
  compareProducts,
} from "./compare";
export {
  type AgentActor,
  type AgentContext,
  autoApproveCeilingPaise,
  buildMerchantContext,
  buildStorefrontContext,
  getMerchantBySlug,
  spendCapPaise,
} from "./context";
export {
  cachedEmbedding,
  cacheKey,
  embeddingQuotaCooldownRemainingMs,
  embeddingQuotaExhausted,
  isQuotaError,
  noteEmbeddingFailure,
  rememberEmbedding,
  resetEmbeddingBudget,
} from "./embedding-budget";
export {
  backfillEmbeddings,
  embeddableText,
  embedQuery,
} from "./embeddings";
export {
  assertCartShape,
  assertWithinSpendCap,
  checkMarginFloor,
  clampDiscountPercent,
  clampFlatDiscount,
  committedSpendPaise,
  LIMITS,
  type MarginBreach,
  recordMarginBreach,
} from "./guardrails";
export {
  type CancellationSummary,
  getCancellationSummary,
  getInventorySummary,
  getLowStockProducts,
  getOrderSummary as getOrderStatusSummary,
  getStockRisk,
  type InventorySummary,
  type LowStockProduct,
  type OrderSummary,
  type StockRisk,
} from "./inventory";
export {
  describeMemories,
  type MemoryEntry,
  recallMemories,
  rememberMemory,
} from "./memory";
export {
  formatPaise,
  paiseToRupees,
  percentageOff,
  rupeesToPaise,
} from "./money";
export {
  CONTEXT_PAGES,
  type ContextPage,
  describeMerchantView,
  type MerchantView,
  type PageContextInput,
  type ResolvedPageContext,
  resolvePageContext,
} from "./page-context";
export {
  getReasoningChain,
  getTranscript,
  persistAssistantMessage,
  persistReasoningStep,
  persistUserMessage,
  type ReasoningStep,
  touchConversation,
} from "./persistence";
export {
  approvalSigningSecret,
  chatModel,
  chatPaceMs,
  chatProviderName,
  describeEmbeddingProvider,
  describeProvider,
  EMBEDDING_DIMENSIONS,
  type EmbeddingTask,
  embeddingModel,
  embeddingModelId,
  embeddingProviderOptions,
  fastModel,
  hasEmbeddingCredentials,
  hasModelCredentials,
  missingCredentialHint,
  toColumnVector,
} from "./provider";
export {
  describeMargin,
  getMarginSummary,
  getProductMargin,
  type MarginSummary,
  type ProductMargin,
} from "./margin";
export {
  type AppliedCampaign,
  getActiveCampaigns,
  type Quote,
  type QuoteCartInput,
  type QuoteLine,
  quoteCart,
  quoteForMerchant,
} from "./quote";
export {
  type DiscontinueCandidate,
  type DiscountCandidate,
  getDiscontinueCandidates,
  getDiscountCandidates,
  getReorderCandidates,
  type ReorderCandidate,
  type WindowedResult,
} from "./recommendations";
export {
  type BuildRequirements,
  canRecommend,
  captureRequirements,
  describeRequirements,
  getRequirements,
  missingFields as missingRequirementFields,
  type RequirementInput,
} from "./requirements";
export {
  canonicalCategory,
  namesOnlyACategory,
  queryTerms,
} from "./search-terms";
export {
  closeTask,
  type FeedbackInput,
  getOpenTask,
  type OpenTaskInput,
  openTask,
  recordFeedback,
  type TaskOutcome,
} from "./tasks";
export {
  type AgentType,
  recordToolCall,
  type ToolCallRecord,
  toolCallRecorder,
} from "./telemetry";
export * from "./tools";
