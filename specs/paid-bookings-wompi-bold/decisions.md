# Decisions

## Accepted Decisions

### Use Native Cal.diy App-Store Integrations

Implement Wompi and Bold as native Cal.diy payment apps under `packages/app-store`.

Reason: Cal.diy already has a payment app abstraction, payment page, app metadata, event-type app settings, and webhook routing. Native apps keep the booking/payment lifecycle in one system and avoid adding a second runtime dependency for the first production version.

### Use payments-hub as Reference, Not Runtime Dependency

Use `/Users/eagarcia/Projects/innovatex/marketplace/payments-hub` as implementation reference for hashing, event mapping, and webhook concepts.

Do not call `payments-hub` from Cal.diy in MVP.

Reason: runtime dependency would require service auth, tenant mapping, webhook callback design, operational monitoring, failure retries, and deployment coordination before the basic paid-booking flow is stable.

### Fix Generic Payment Page First

Repair `/payment/[uid]` before implementing Wompi or Bold.

Reason: both new providers depend on this page. The current page returns placeholder data and cannot support real paid bookings reliably.

### Support ON_BOOKING First

Only support `PaymentOption.ON_BOOKING` for Wompi and Bold in MVP.

Reason: `HOLD` requires authorization/capture semantics. Wompi Web Checkout and Bold payment button do not map cleanly to Cal.diy no-show fee behavior without extra provider-specific work.

### No Prisma Schema Change for MVP

Use the existing `Payment` table and `Payment.data`.

Reason: existing fields are enough for payment creation, checkout rendering, and webhook reconciliation.

### Webhooks Own Payment Confirmation

Only provider webhooks should mark bookings as paid.

Reason: client redirects can be spoofed or arrive before final provider settlement. `handlePaymentSuccess` centralizes the correct booking side effects.

## Open Questions

### Wompi Currency Scope

Owner needed: product/ops.

Question: Should Wompi support only `COP` for MVP?

Recommendation: yes, only `COP`.

### Bold Currency Scope

Owner needed: product/ops.

Question: Should Bold support `COP` only, or `COP` and `USD`?

Recommendation: start with `COP` unless there is a verified production requirement for `USD`.

### Sandbox Credentials

Owner needed: ops.

Question: Who provides sandbox credentials and webhook event secrets for Wompi and Bold?

Recommendation: create shared sandbox accounts before PR 4 and PR 7 manual QA.

### Refund Policy UI

Owner needed: product.

Question: Should refund policy be shown for providers where refund API is not implemented?

Recommendation: hide or disable refund policy for Wompi/Bold MVP, or show it as informational only. Do not promise automatic refunds until implemented.

### Cancelled Booking with Late Payment

Owner needed: product.

Question: If a booking is cancelled while payment is pending, and a later webhook confirms payment, should Cal.diy revive the booking, keep it cancelled, or flag it for manual handling?

Recommendation: keep booking cancelled and log the late payment for manual handling in MVP.

### Team Credentials

Owner needed: engineering lead.

Question: Should Wompi/Bold credentials be user-level only in MVP, or support team credentials immediately?

Recommendation: follow the current payment app credential lookup in `RegularBookingService` and avoid custom team logic until a failing case is found.

## Rejected Options

### Reuse Stripe App Internals

Rejected because Stripe is partially disabled in this community edition copy and its component is removed from the payment page. Stripe also has provider-specific customer, PaymentIntent, and connected-account semantics that do not apply to Wompi/Bold checkout.

### Add a New PaymentIntent Table in Cal.diy

Rejected for MVP because `Payment` already represents pending/success/refunded state and links to booking.

### Confirm Payment from Redirect URL

Rejected because redirect URLs are client-controlled and not a reliable source of payment truth.

