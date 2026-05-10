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

### Wompi Currency Scope (resolved 2026-05-10)

Decision: Support `COP` and `USD` for Wompi in MVP.

Reason: Product confirmed need for both Colombian and international hosts. Requires per-event-type currency selector and validation that the merchant Wompi account has the chosen currency enabled.

Implementation note: signature generation must use the exact uppercase currency code passed to checkout. QA must cover both COP and USD signature paths.

### Bold Currency Scope (resolved 2026-05-10)

Decision: Support only `COP` for Bold in MVP.

Reason: Avoid asymmetric scope across both gateways and reduce QA surface. USD requires Bold merchant account with USD enabled and integrity hash validation per currency. Re-evaluate once a real host requests USD.

### Refund Policy UI (resolved 2026-05-10)

Decision: Hide the refund policy field for Wompi and Bold in MVP.

Reason: `PaymentService.refund()` throws `not implemented`. Showing a configurable refund policy creates a contract the system cannot honor. Re-enable the field when refund APIs are implemented for each gateway.

### Cancelled Booking with Late Payment (resolved 2026-05-10)

Decision: Keep the booking cancelled and log the late payment for manual handling.

Reason: Resurrecting a booking the attendee already cancelled creates surprise. Manual review preserves attendee expectation and gives ops a clear hand-off for refund/reconciliation.

Implementation note: webhook should still ACK 200 to prevent provider retries, update `Payment.data` with the late status, and emit a structured log entry that ops dashboards can pick up.

### Sandbox Credentials (resolved 2026-05-10)

Decision: Use a single shared sandbox account per gateway, credentials stored in the team secret manager (1Password/Vault).

Reason: Balances onboarding friction against consistent QA. Avoid per-developer signups that break when sandbox keys rotate.

Action: ops to provision Wompi and Bold sandbox accounts and document retrieval steps in `junior-runbook.md`. Block manual QA until both are available.

### Team Credentials (resolved 2026-05-10)

Decision: User-level credentials only in MVP.

Reason: Matches existing `RegularBookingService` lookup. Team-level lookup adds priority rules and edge cases that have no validated production demand yet.

## Open Questions

None at this time. Re-open if QA or production reveals a gap.

## Rejected Options

### Reuse Stripe App Internals

Rejected because Stripe is partially disabled in this community edition copy and its component is removed from the payment page. Stripe also has provider-specific customer, PaymentIntent, and connected-account semantics that do not apply to Wompi/Bold checkout.

### Add a New PaymentIntent Table in Cal.diy

Rejected for MVP because `Payment` already represents pending/success/refunded state and links to booking.

### Confirm Payment from Redirect URL

Rejected because redirect URLs are client-controlled and not a reliable source of payment truth.

