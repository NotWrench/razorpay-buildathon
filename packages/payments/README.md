# @workspace/payments

Razorpay integration: order creation, signature verification, payment links,
refunds and webhook settlement. All amounts are in the smallest currency unit
(paise), matching `products.price` and `orders.totalAmount`.

## Environment

```bash
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx      # Dashboard > Settings > Webhooks
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

A merchant that has connected its own Razorpay account (`merchants.razorpayKeyId`
/ `razorpayKeySecret`, or `razorpayAccessToken` for OAuth) is billed through that
account; everyone else falls back to the platform keys above.

## Modules

| File               | Responsibility                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| `client.ts`        | Razorpay SDK client per merchant, credential resolution                 |
| `orders.ts`        | Cart pricing, order persistence, approval, Razorpay order creation      |
| `payments.ts`      | Checkout verification, manual capture, refunds, status                  |
| `payment-links.ts` | Hosted payment links + callback verification (the AI-agent handoff)     |
| `settlement.ts`    | Idempotent status transitions, stock draw-down                          |
| `signature.ts`     | HMAC-SHA256 verification (checkout, payment link, webhook)              |
| `webhooks.ts`      | Signature check + event dispatch                                        |
| `audit.ts`         | Audit log and failure log writes                                        |

## HTTP endpoints (`apps/web`)

Auth: a better-auth session cookie (human buyer / merchant) or an `x-api-key`
header issued to an external AI agent. `/verify`, `/links/callback` and the
webhook authenticate via Razorpay signatures instead.

| Method | Path                                       | Who              | Purpose                                             |
| ------ | ------------------------------------------ | ---------------- | --------------------------------------------------- |
| POST   | `/api/payments/orders`                     | buyer or agent   | Price cart, create order (+ Razorpay order if human) |
| GET    | `/api/payments/orders/{orderId}`           | buyer or merchant| Order, items, payment attempts                       |
| POST   | `/api/payments/orders/{orderId}/approve`   | merchant         | Approve agent purchase → returns checkout handoff    |
| POST   | `/api/payments/orders/{orderId}/reject`    | merchant         | Reject and cancel                                    |
| POST   | `/api/payments/verify`                     | signature        | Verify Checkout handshake, settle order              |
| POST   | `/api/payments/links`                      | buyer or merchant| Create hosted payment link                           |
| GET    | `/api/payments/links/callback`             | signature        | Payment link redirect target                         |
| POST   | `/api/payments/capture`                    | merchant         | Manual capture of an authorized payment              |
| POST   | `/api/payments/refund`                     | merchant         | Full or partial refund                               |
| POST   | `/api/webhooks/razorpay`                   | signature        | Source of truth for payment state                    |

Responses are `{ success: true, data }` or
`{ success: false, error: { code, message, details } }`.

## Flows

**Human checkout.** `POST /api/payments/orders` returns
`checkout: { keyId, razorpayOrderId, amount, currency }`. Open Razorpay Checkout
with it, then post the handler's `razorpay_order_id` / `razorpay_payment_id` /
`razorpay_signature` to `/api/payments/verify`.

**Agent purchase.** The agent calls `POST /api/payments/orders` with `x-api-key`
and an `aiPurchaseReason`. The order comes back `pending_approval` with
`checkout: null`. Once the merchant approves it, `POST /api/payments/links`
yields a URL the agent can hand to the human — no card data ever reaches the
agent.

## Webhooks

Point the Razorpay dashboard at `POST /api/webhooks/razorpay` with the secret
from `RAZORPAY_WEBHOOK_SECRET` and subscribe to `payment.authorized`,
`payment.captured`, `payment.failed`, `order.paid`, `payment_link.paid`,
`payment_link.expired` and `refund.processed`.

Verification hashes the **raw** request body, so the route reads
`request.text()` — never re-serialize the parsed JSON. Handlers are idempotent
(a second `payment.captured` is a no-op), so Razorpay's retries are safe, and
stock is drawn down exactly once, on the first capture.

Local testing:

```bash
bunx ngrok http 3000   # then register https://<id>.ngrok.app/api/webhooks/razorpay
```
