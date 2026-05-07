# Paid Bookings with Wompi and Bold

## Purpose

This folder is the master implementation plan for enabling paid event types in Cal.diy with Wompi and Bold as payment gateways.

The final product must allow a host to:

1. Install and configure Wompi or Bold as a payment app.
2. Enable payment on an event type.
3. Set price, currency, payment option, and refund policy where supported.
4. Let an attendee book a paid event.
5. Redirect the attendee to a working payment experience.
6. Confirm the booking only after the gateway reports a successful payment.
7. Keep the booking, payment record, emails, webhooks, and UI in sync.

## Documents

- [design.md](./design.md): architecture, user flows, data model, and integration boundaries.
- [implementation.md](./implementation.md): phased implementation plan with PR-sized tasks.
- [gateway-details.md](./gateway-details.md): Wompi and Bold technical requirements, signatures, payloads, and webhook mapping.
- [testing.md](./testing.md): unit, integration, manual QA, and regression test plan.
- [junior-runbook.md](./junior-runbook.md): step-by-step execution guide for junior engineers.
- [decisions.md](./decisions.md): decisions already made and questions that need owner confirmation.

## Current Repo Reality

Cal.diy already has most of the paid-booking domain model and orchestration:

- `Booking.paid` and `Payment` exist in `packages/prisma/schema.prisma`.
- Paid booking creation is handled in `packages/features/bookings/lib/service/RegularBookingService.ts`.
- Payment provider abstraction is defined in `packages/types/PaymentService.d.ts`.
- Payment success is centralized in `packages/app-store/_utils/payments/handlePaymentSuccess.ts`.
- Event-type payment settings are based on app metadata under `eventType.metadata.apps`.

However, the current payment experience has gaps that must be fixed before adding gateways:

- `apps/web/app/(use-page-wrapper)/payment/[uid]/page.tsx` currently returns placeholder data instead of loading the real payment.
- `apps/web/app/(use-page-wrapper)/payment/[uid]/PaymentPage.tsx` no longer renders a Stripe payment component and only knows about existing apps.
- `apps/web/pages/api/integrations/stripepayment/webhook.ts` returns `404` in community edition.
- `packages/app-store/payment.services.generated.ts` is generated and must not be edited manually.

## Target Architecture

Use native Cal.diy app-store integrations:

- `packages/app-store/wompi`
- `packages/app-store/bold`
- `apps/web/components/apps/wompi`
- `apps/web/components/apps/bold`
- `apps/web/pages/api/integrations/wompi/webhook.ts`
- `apps/web/pages/api/integrations/bold/webhook.ts`

Use `/Users/eagarcia/Projects/innovatex/marketplace/payments-hub` as a reference implementation for hashing and webhook concepts, but do not make Cal.diy depend on it at runtime for the first production implementation.

## Definition of Done

The feature is done when:

- A host can install Wompi and configure credentials without exposing secrets.
- A host can install Bold and configure credentials without exposing secrets.
- A host can enable exactly one payment app on an event type.
- A paid event booking creates a `Payment` record with correct `appId`, `amount`, `currency`, `externalId`, and `data`.
- The attendee is sent to a working payment page for the selected gateway.
- Successful gateway webhook calls `handlePaymentSuccess`.
- Failed or cancelled gateway webhook does not mark booking as paid.
- Duplicate webhook delivery is idempotent.
- Awaiting payment reminders still work.
- `BOOKING_PAYMENT_INITIATED` and `BOOKING_PAID` webhooks are emitted correctly.
- Relevant unit tests and manual QA pass.

## Required Commands

Use these before opening a PR:

```bash
yarn biome check --write .
yarn type-check:ci --force
TZ=UTC yarn test
```

Run narrower tests during development whenever possible.

## External References

- Wompi checkout and integrity signature: https://docs.wompi.co/en/docs/colombia/widget-checkout-web/
- Wompi events and checksum validation: https://docs.wompi.co/en/docs/colombia/eventos/
- Bold payment button and integrity hash: https://developers.bold.co/products/payment-button
- Bold webhook signature validation: https://developers.bold.co/products/webhook

