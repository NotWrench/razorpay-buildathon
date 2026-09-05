<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-memory -->
# Project Memory: Agentic PC Commerce Platform

## 1. Project Overview

This project is a working mock PC-commerce platform where customers can browse PC components, build a custom PC, place an order, and interact with an AI agent throughout the shopping process.

The core differentiator is a **two-sided AI agent system**:

1. **Customer-side agent** helps shoppers understand products, compare components, choose compatible parts, build a PC, discover better-value alternatives, resolve doubts, and complete a purchase.
2. **Admin/owner-side agent** analyzes store operations and recommends actions around inventory, sales, orders, pricing, product performance, and purchasing decisions.

The AI must not behave like a generic chatbot disconnected from the commerce system. It should use current application data and controlled tools to perform useful, grounded actions.

---

## 2. Main Product Model

The site represents a PC parts retailer that sells components such as:

- CPUs
- GPUs
- Motherboards
- RAM
- Storage
- PSUs
- PC cases
- CPU coolers
- Case fans
- Monitors and peripherals if needed
- Prebuilt/custom PC configurations if needed

Customers can buy individual products or assemble a custom PC from compatible parts.

A custom PC build should be treated as a structured configuration rather than a plain text conversation. The system should know which component category each selected product belongs to and validate compatibility before allowing checkout.

---

## 3. Customer AI Agent

### 3.1 Primary Goal

Help a customer go from an uncertain shopping intent to a valid, valuable cart/order with as little friction as possible.

The agent should be able to:

- Understand natural-language shopping requirements.
- Ask targeted questions to discover needs.
- Recommend products from the store catalog.
- Explain why a product fits the customer's requirements.
- Compare products available on the site.
- Identify compatibility problems in a custom PC build.
- Suggest better-value alternatives.
- Suggest upgrades when spending slightly more creates meaningful value.
- Answer product and technical questions.
- Summarize the customer's final selections.
- Help the customer proceed toward payment.

The agent should prefer products that actually exist in the platform database. It must not invent products, prices, inventory counts, benchmark values, specifications, or compatibility claims that are not supported by the available data.

---

### 3.2 Recommendation Interview

When the customer does not know exactly what to buy, the agent should conduct a lightweight requirement-discovery conversation.

Useful questions include:

- Budget
- Main use case: gaming, streaming, editing, development, AI/ML, office work, mixed use, etc.
- Target resolution and refresh rate for gaming
- Preferred games or software
- Existing parts the customer already owns
- Required storage capacity
- Preferred upgrade path
- Important constraints such as form factor, PSU capacity, or case size

The agent should avoid asking unnecessary questions. It should infer obvious information when safely possible and ask only for missing information that materially changes the recommendation.

The resulting recommendation should be structured internally as something like:

```text
Customer requirements
-> constraints
-> candidate products
-> compatibility checks
-> ranked recommendations
-> value/upgrades
-> final selectable items
```

---

### 3.3 Recommendation Output

Recommendations should be represented as actionable product selections, not only prose.

Each recommended item should be associated with:

- Product ID
- Category
- Product name
- Current price
- Relevant specifications
- Availability/stock state
- Reason for recommendation
- Compatibility status when relevant
- Optional alternative
- Optional upgrade suggestion

The agent should be able to produce two recommendation levels:

**Best-fit recommendation:** the choice that most directly satisfies the customer's requirements and budget.

**Better-value/upgrade recommendation:** a more expensive option only when the additional spend has a clear benefit relative to the customer's stated requirements.

Do not recommend expensive upgrades merely because they are more powerful.

---

## 4. PC Builder Intelligence

The customer agent is also responsible for reasoning about custom PC builds.

At minimum, the system should validate relevant relationships such as:

- CPU ↔ motherboard socket/platform
- Motherboard ↔ RAM generation/type
- Motherboard ↔ case form factor
- GPU ↔ case dimensions where data exists
- PSU ↔ estimated system power requirement
- PSU ↔ required GPU/CPU power connectors where data exists
- CPU ↔ motherboard BIOS compatibility where data exists
- Cooler ↔ CPU socket and case constraints where data exists
- Storage ↔ motherboard interface/slot availability where data exists
- Number of selected components ↔ available motherboard slots/connectors where data exists

Compatibility rules should be implemented as deterministic application logic where practical. The LLM can interpret, explain, prioritize, and communicate the results, but safety-critical commerce validation should not depend solely on model reasoning.

The AI should be able to return clear states such as:

- Compatible
- Potentially compatible / requires verification
- Incompatible
- Insufficient data

Never silently assume compatibility when required specification data is missing.

---

## 5. Upgrade and Cross-Sell Logic

The agent should recognize opportunities where a slightly higher spend could deliver materially better value.

Examples:

- Faster GPU for a target gaming resolution
- Higher-capacity or faster RAM when the workload benefits from it
- Larger SSD when the customer is likely to exceed the selected capacity
- Better PSU when the current choice leaves insufficient headroom
- Better CPU cooler when thermals or sustained workloads justify it

Recommendations should be justified with a concrete tradeoff:

```text
Current choice: ₹X
Upgrade: ₹Y
Additional spend: ₹Z
Why it may be worth it: ...
```

The agent must not manipulate users into unnecessary purchases. The recommendation should be tied to their goals.

---

## 6. Customer Chat Modes / Task Types

The main customer chat can support explicit task modes. A selected mode should influence the agent's behavior and tool usage.

Suggested initial modes:

### About
Answer questions about a specific product, category, feature, specification, or store product.

### Compare
Compare two or more products that exist in the store catalog.

Example intent:

```text
Compare RTX 3060 vs RTX 3060 Ti.
```

The agent should retrieve the actual corresponding products and compare meaningful attributes such as price, performance-related specifications available in the database, power requirements, memory, intended use, and value.

### Recommend
Help choose products based on requirements, budget, and use case.

### Build
Help create or validate a complete PC configuration.

### Orders
Answer questions about the customer's own orders when authenticated data permits it.

The architecture should remain extensible so more modes can be added without creating a separate agent implementation for every mode.

---

## 7. Context-Aware Customer Assistant

The customer assistant should understand application context.

Examples:

- On a product page, it should be able to use the current product as context.
- During PC building, it should understand the customer's current selections.
- In cart/checkout flow, it should understand the current cart and any validation warnings.
- On the search/product discovery experience, it should use the current search intent where available.
- On an order page, it should be able to answer questions about that order, subject to authorization.

The frontend should send structured context to the agent rather than forcing the model to infer everything from a URL or raw page text.

Example context:

```json
{
  "page": "product",
  "productId": "gpu-123",
  "selectedBuild": {
    "cpuId": "cpu-10",
    "motherboardId": "mb-3",
    "gpuId": "gpu-123"
  },
  "cartId": "cart-456"
}
```

Only send the minimum context necessary for the current task.

---

## 8. Customer Checkout Flow

The intended customer journey is:

```text
Browse / Search
-> Ask agent or select products
-> Recommendation / comparison / build assistance
-> Compatibility validation
-> Review selected products
-> Cart
-> Checkout
-> Razorpay payment
-> Order creation / confirmation
```

The agent can guide the customer through this flow, but payment and order state must remain controlled by backend application logic.

The AI should never directly claim that payment succeeded unless the backend/payment system confirms it.

---

## 9. Admin / Owner AI Agent

### 9.1 Primary Goal

Give the store owner an operational intelligence layer that turns raw commerce data into useful decisions and actions.

The admin agent should answer questions and generate insights around:

- Inventory
- Sales
- Orders
- Product performance
- Revenue trends
- Slow-moving products
- Fast-moving products
- Pending orders
- Cancelled orders
- New orders
- Stock risks
- Pricing opportunities
- Discount opportunities
- Reorder opportunities
- Product discontinuation candidates

The agent should combine summaries with concrete recommended actions.

---

## 10. Admin Operational Summary

The admin dashboard should be able to surface a current summary such as:

- Current stock health
- Recently sold products
- Recent orders
- Pending orders
- Cancelled orders
- Newly placed orders
- Top-selling products
- Slow-selling products
- Revenue snapshots
- Products approaching low-stock thresholds

The AI should explain important movements instead of merely repeating database values.

Example:

```text
GPU X is selling significantly faster than its recent average while stock is low.
Recommended action: reorder approximately N units, subject to supplier constraints.
```

Any numeric recommendation should identify the underlying data window/assumptions when relevant.

---

## 11. Admin Sales Recommendations

The agent should identify opportunities such as:

### Discount candidates
Products with weak sales velocity, excess stock, or aging inventory.

Suggested output:

```text
Product
Problem
Suggested action
Reason
Expected objective
```

### Reorder candidates
Products with high sales velocity, low remaining stock, or projected stock-out risk.

Suggested output:

```text
Product
Current stock
Recent sales velocity
Estimated risk
Suggested reorder quantity
```

### Discontinue candidates
Products that consistently underperform relative to their cost, inventory burden, or category alternatives.

The agent should frame discontinuation as a recommendation, not an automatic deletion.

Example:

```text
Product X has low sales velocity and has remained in inventory for a long period.
Recommendation: consider discontinuing or replacing it.
```

---

## 12. Admin Agent Actions

The admin agent may eventually perform controlled actions through tools, but analytical recommendations and irreversible mutations should be separated.

Potential tool-backed admin actions:

- Update stock thresholds
- Create/update draft discount recommendations
- Update product metadata
- Create purchase/reorder requests
- Mark recommendations for review
- Fetch order details
- Fetch sales reports
- Fetch inventory reports

Actions that materially change commerce state should require explicit authorization and, where appropriate, an approval step.

The model should not have unrestricted database write access.

---

## 13. Agent Architecture

The project should use an agentic architecture built around the Vercel AI SDK and Gemini, with tool calling and MCP where appropriate.

Conceptually:

```text
User
  |
  v
Next.js application
  |
  v
AI orchestration layer
  |
  +--> Gemini model
  |
  +--> Tool calls
  |      |
  |      +--> Product search
  |      +--> Product lookup
  |      +--> Compatibility checks
  |      +--> Cart/build state
  |      +--> Order information
  |      +--> Inventory analytics
  |      +--> Sales analytics
  |      +--> Admin actions
  |
  +--> Agent database
  |
  +--> Platform database
```

The exact orchestration pattern can evolve, but the important principle is that the model reasons over structured application data through controlled tools.

---

## 14. Two-Database Architecture

There are two separate databases:

### Platform database
Source of truth for commerce/business data, such as:

- Users/customers
- Products
- Categories
- Product specifications
- Inventory
- Builds
- Carts
- Orders
- Order items
- Payments
- Admin/store records

### Agent database
Used for AI-specific state and supporting data, such as:

- Conversation/session state
- Agent messages
- Agent task metadata
- Tool-call logs
- Recommendation history
- Feedback/evaluation data
- Agent preferences/configuration where appropriate
- Summaries or derived analytics cached for agent use

Do not duplicate authoritative commerce data unnecessarily in the agent database. The platform database remains the source of truth for product, inventory, order, and payment state.

---

## 15. Data Ownership Rule

A core system rule:

**The AI database is not the source of truth for commerce.**

For example:

- Product price -> platform DB
- Product stock -> platform DB
- Order status -> platform DB
- Payment status -> payment provider/platform DB integration
- Customer recommendation history -> agent DB
- Chat messages -> agent DB

When the agent needs current commerce information, it should use tools that read the platform database.

---

## 16. Tool Calling

Tools should be small, explicit, permission-aware functions.

Possible customer tools:

```text
searchProducts(query, filters)
getProduct(productId)
compareProducts(productIds)
getProductRecommendations(requirements)
checkBuildCompatibility(build)
getBuild(buildId)
updateBuild(buildId, changes)
getCart(cartId)
addToCart(cartId, productId, quantity)
removeFromCart(cartId, productId)
getCustomerOrder(orderId)
```

Possible admin tools:

```text
getInventorySummary(filters)
getSalesSummary(dateRange, filters)
getOrderSummary(filters)
getProductPerformance(filters)
getLowStockProducts(filters)
getSlowMovingProducts(filters)
getTopSellingProducts(filters)
getCancellationSummary(filters)
getAdminRecommendations(filters)
```

Mutation tools should be separately permissioned and named clearly.

Examples:

```text
createDiscountDraft(...)
createReorderRequest(...)
updateInventoryThreshold(...)
```

Avoid generic tools such as `runSql` or unrestricted database execution exposed to the model.

---

## 17. MCP Usage

MCP can be used to expose well-defined capabilities to the agent ecosystem.

The MCP layer should expose domain tools/resources rather than raw database access.

Good MCP abstraction:

```text
products.search
products.get
products.compare
build.checkCompatibility
inventory.summary
sales.summary
orders.summary
```

Bad abstraction:

```text
postgres.executeAnySql
```

The MCP/tool layer should enforce authentication, authorization, validation, and safe parameter boundaries before a request reaches the underlying database.

---

## 18. Agent Memory

Agent memory should be divided into practical categories.

### Conversation memory
What has been discussed in the current session.

### Preference memory
Stable shopping preferences when the application intentionally stores them, such as a preferred budget range or intended use.

### Task state
Current recommendation/build/comparison workflow state.

### Business memory
Admin-side derived insights or historical summaries that are useful to future analysis.

Avoid storing unnecessary personal information.

The agent should not assume that something mentioned in conversation is a durable user preference unless the system explicitly records it as such.

---

## 19. Grounding Rules

The AI must be grounded in application data.

For store-specific claims, retrieve current data rather than relying on model memory.

Examples of claims that should normally be tool-grounded:

- Current price
- Current stock
- Product availability
- Product specifications stored by the site
- Whether two store products are compatible
- Current order status
- Current sales numbers
- Inventory counts
- Store performance metrics

The model can provide general technical explanations, but should clearly distinguish general knowledge from store-specific facts when necessary.

---

## 20. Permissions and Security

Customer and admin agents have different permissions.

### Customer agent
May access only data appropriate to the authenticated customer/session.

### Admin agent
May access store-wide operational information only for authorized admin users.

Never allow a customer prompt to retrieve another customer's orders, personal information, or private store analytics.

Never rely on the model to enforce authorization. Authorization must be enforced by backend tools/services.

Important rule:

```text
Authentication + authorization happen before tool execution.
```

---

## 21. Payment and Order Safety

Razorpay handles payment processing.

The AI may explain checkout/payment steps and guide the customer, and — where the customer has granted a standing authorisation with caps and an expiry — it may *initiate* a payment against it. It still may not fabricate payment outcomes, and that rule matters more once the agent can start one: initiating a charge and knowing it succeeded are different facts, and only the gateway and the settlement path establish the second.

A payment settled through the simulated instrument must always be reported as simulated. That is not an outcome the agent may round up.

Payment state must be confirmed through trusted backend/payment-provider data.

Order creation, payment verification, and order status transitions should be deterministic backend operations rather than free-form model actions.

---

## 22. Agent Behavior Principles

The agent should be:

- Helpful
- Grounded
- Context-aware
- Concise by default
- Willing to ask clarifying questions when necessary
- Transparent about uncertainty
- Focused on the customer's actual goal
- Action-oriented

The agent should not:

- Invent products
- Invent stock
- Invent prices
- Invent compatibility
- Claim an action succeeded without confirmation
- Recommend products solely because they are more expensive
- Expose unauthorized data
- Make irreversible admin changes without the required authorization

When data is missing, say that the data is unavailable and use the safest available path.

---

## 23. Agent Workflow Pattern

A typical request should follow a reasoning pattern like:

```text
1. Understand intent
2. Identify required context
3. Determine whether tools are needed
4. Retrieve authoritative data
5. Reason over retrieved data
6. Validate constraints
7. Produce answer/recommendation
8. Offer an actionable next step when relevant
```

For example, a comparison request:

```text
User asks to compare two GPUs
-> identify the two products
-> fetch exact product records
-> compare relevant attributes
-> explain practical differences
-> relate differences to likely use cases
-> recommend one only when enough context exists
```

For a PC build:

```text
Collect requirements
-> recommend candidate parts
-> retrieve exact product data
-> run compatibility checks
-> resolve conflicts
-> calculate total
-> propose value upgrades
-> present final selectable configuration
```

---

## 24. Observability and Evaluation

Because this is an agentic system, tool calls and important decisions should be observable.

Track useful metadata such as:

- Session ID
- Agent type: customer/admin
- Intent/task type
- Tool calls
- Tool success/failure
- Recommendation IDs
- Latency
- Model response metadata where appropriate
- User feedback
- Outcome where measurable

Useful evaluation cases include:

- Correct product retrieval
- Accurate comparison
- Correct compatibility detection
- No hallucinated inventory
- Correct permission enforcement
- Correct order/customer isolation
- Useful upgrade recommendations
- Useful admin inventory recommendations

---

## 25. Page/Capability Context

The exact UI is not the focus of this memory document. However, the application should expose capabilities that naturally correspond to common commerce pages.

Likely capability areas include:

- Landing/home experience
- Product discovery/search
- Product detail
- PC builder/configurator
- Cart
- Checkout/payment
- Order details/history
- Customer AI chat page
- Admin dashboard
- Admin inventory
- Admin products
- Admin orders
- Admin analytics/recommendations

The agent must be reusable across these contexts instead of being tightly coupled to one page.

---

## 26. Suggested Domain Model

A practical starting domain model:

```text
User
Product
ProductCategory
ProductSpecification
Inventory
Build
BuildItem
Cart
CartItem
Order
OrderItem
Payment

AgentSession
AgentMessage
AgentTask
AgentRecommendation
AgentToolCall
AgentFeedback
```

Additional models can be introduced as the implementation requires them.

---

## 27. Recommended Separation of Concerns

### Next.js app
Responsible for:

- Pages/routes
- Auth/session integration
- Server actions/API routes
- Customer/admin application flows
- AI streaming to the client

### Drizzle
Responsible for typed database access and schema management.

### Bun
Used as the runtime/package/tooling environment where appropriate.

### Vercel AI SDK + Gemini
Responsible for model interaction, streaming, structured generation, and tool calling.

### MCP
Provides standardized domain capabilities to agents/tools where useful.

### Razorpay
Responsible for payment processing and payment verification integration.

### Platform DB
Authoritative commerce state.

### Agent DB
AI/session/recommendation state.

---

## 28. Implementation Philosophy

Build the commerce system first as a reliable deterministic application, then make the agent a controlled intelligence layer on top of it.

The correct relationship is:

```text
Commerce system = source of truth + deterministic rules
AI agent = reasoning + conversation + orchestration + recommendations
Tools/MCP = controlled bridge between the two
```

Do not build the AI as a layer that directly manipulates raw database state.

---

## 29. Example End-to-End Customer Scenario

User:

```text
I need a gaming PC around ₹80,000 for 1440p gaming. I mostly play competitive shooters and a few AAA games.
```

Agent process:

```text
1. Detect gaming-build intent.
2. Ask only high-value missing questions if necessary.
3. Search the catalog for candidate CPUs, GPUs, motherboard, RAM, storage, PSU, case, and cooler.
4. Build candidate configurations.
5. Check compatibility.
6. Rank configurations against the user's budget/use case.
7. Provide a best-fit configuration.
8. Provide one upgrade path if a small additional spend meaningfully improves the result.
9. Let the customer select the desired products.
10. Add selections to the build/cart through controlled actions.
11. Validate again before checkout.
12. Send the user through the normal payment/order flow.
```

---

## 30. Example End-to-End Admin Scenario

Admin:

```text
What should I do with my inventory this week?
```

Agent process:

```text
1. Retrieve recent inventory, sales, and order data.
2. Identify fast-moving products at stock risk.
3. Identify slow-moving products with excessive inventory.
4. Identify meaningful pricing/discount opportunities.
5. Identify products that may be candidates for discontinuation.
6. Rank recommendations by urgency and expected impact.
7. Explain the evidence behind each recommendation.
8. Offer controlled actions such as creating reorder/discount drafts where supported.
```

---

## 31. Technology Stack

Current intended stack:

```text
Monorepo: Turborepo
Frontend/Application: Next.js
Runtime/Package Manager: Bun
ORM: Drizzle ORM
Model: Gemini
AI SDK: Vercel AI SDK
Payments: Razorpay
Tooling/Interoperability: MCP + tool calls
Databases: Two separate databases
  - Platform / commerce DB
  - Agent / AI DB
```

Keep the architecture modular so the model provider or tool transport can be changed later without rewriting the commerce layer.

---

## 32. Non-Negotiable System Rules

1. Platform commerce data is authoritative.
2. AI uses tools for current store-specific facts.
3. Deterministic compatibility logic should be preferred over pure LLM judgment.
4. Backend services enforce authorization, not the model.
5. Customer and admin capabilities are separated.
6. Payment/order state is confirmed by backend systems.
7. Tool access is explicit and least-privilege.
8. No unrestricted SQL/database tool is exposed to the model.
9. Recommendations should be explainable and tied to user/business goals.
10. The agent should admit uncertainty instead of fabricating information.
11. Admin mutations should be controlled and approval-aware.
12. The AI layer should remain reusable across commerce pages and workflows.

---

## 33. Long-Term Direction

The project should evolve toward a reusable **agentic commerce toolkit** rather than a one-off PC store chatbot.

The PC store is the initial reference implementation because it has rich product attributes, compatibility constraints, recommendation opportunities, and operational analytics.

The underlying architecture should make it possible to adapt the same agent framework to other stores by changing:

- Product schema/configuration
- Business rules
- Recommendation logic
- Tool definitions
- Admin metrics
- Store-specific policies

The reusable abstraction is:

```text
Commerce data
+ domain rules
+ agent tools
+ customer shopping agent
+ admin operations agent
= agentic commerce platform
```
<!-- END:project-memory -->