# Paid Bookings with Wompi and Bold Design

## Overview

Cal.diy should support paid event types using Wompi and Bold as first-class payment apps. The booking flow should create the booking in an awaiting-payment state, create a provider-specific payment record, redirect the attendee to pay, and mark the booking as paid only when the provider confirms success.

## Problem Statement

The existing project has the domain model and generic paid-booking flow, but the active payment page is incomplete and new Colombian gateways are not available. Hosts need local payment options that work with Wompi and Bold while preserving Cal.diy behavior for booking creation, payment reminders, booking confirmation, email delivery, and webhook events.

## User Stories

- As a host, I want to connect Wompi so attendees can pay for appointments using Colombian payment methods.
- As a host, I want to connect Bold so attendees can pay for appointments through Bold checkout.
- As a host, I want to configure price and currency per event type.
- As an attendee, I want to complete payment after selecting a booking slot.
- As an attendee, I want to see whether payment is pending, paid, failed, or refunded.
- As an admin, I want secrets stored only in credentials and never returned to client payloads.
- As a platform integrator, I want `BOOKING_PAYMENT_INITIATED` and `BOOKING_PAID` webhooks to keep working.

## Existing Flow

1. The attendee submits the booking form through `apps/web/modules/bookings/hooks/useBookings.ts`.
2. The client calls `packages/features/bookings/lib/create-booking.ts`.
3. The server enters `packages/features/bookings/lib/service/RegularBookingService.ts`.
4. If `bookingRequiresPayment` is true, `RegularBookingService` loads payment credentials and calls `handlePayment`.
5. `handlePayment` resolves the payment app from `PaymentServiceMap`, creates a `Payment`, calls `afterPayment`, and returns `paymentUid`.
6. The client redirects to `/payment/{paymentUid}`.
7. Gateway webhook must call `handlePaymentSuccess`.
8. `handlePaymentSuccess` marks `Payment.success = true`, `Booking.paid = true`, updates booking status, creates calendar references if needed, sends emails/SMS, and emits `BOOKING_PAID`.

## Key Existing Files

- `packages/prisma/schema.prisma`
- `packages/types/PaymentService.d.ts`
- `packages/features/bookings/lib/handlePayment.ts`
- `packages/features/bookings/lib/service/RegularBookingService.ts`
- `packages/app-store/_utils/payments/getPaymentAppData.ts`
- `packages/app-store/_utils/payments/handlePaymentSuccess.ts`
- `packages/features/tasker/tasks/sendAwaitingPaymentEmail.ts`
- `apps/web/app/(use-page-wrapper)/payment/[uid]/page.tsx`
- `apps/web/app/(use-page-wrapper)/payment/[uid]/PaymentPage.tsx`
- `apps/web/pages/api/integrations/[...args].ts`

## Database Design

No schema migration is required for the first implementation.

Use the existing `Payment` table:

- `uid`: Cal.diy payment page identifier.
- `appId`: `wompi` or `bold`.
- `bookingId`: linked booking.
- `amount`: smallest unit expected by Cal.diy payment flow.
- `fee`: set to `0` initially.
- `currency`: uppercase currency code.
- `success`: `false` until provider confirms success.
- `refunded`: `false` initially.
- `externalId`: provider reference or gateway checkout reference.
- `data`: non-secret provider payload needed by the payment page and webhook reconciliation.
- `paymentOption`: support `ON_BOOKING` first.

Do not add gateway secrets to `Payment.data`.

## Payment App Metadata

Each app stores event-type settings in `eventType.metadata.apps.{appId}`.

Minimum metadata for both apps:

- `enabled`
- `price`
- `currency`
- `paymentOption`
- `credentialId`
- `refundPolicy`
- `refundDaysCount`
- `refundCountCalendarDays`
- `appCategories`

Use the existing Stripe, PayPal, HitPay, Alby, and BTCPay implementations as references, but do not copy provider-specific assumptions blindly.

## Credential Shape

### Wompi

Store in `Credential.key`:

- `publicKey`
- `privateKey`
- `integritySecret`
- `eventSecret`
- `environment`

Only `publicKey` may be exposed to the browser.

### Bold

Store in `Credential.key`:

- `apiKey`
- `secretKey`
- `webhookSecret`
- `environment`

Only `apiKey` may be exposed to the browser if required by Bold checkout.

## API Design

### Payment Page Loader

Fix `apps/web/app/(use-page-wrapper)/payment/[uid]/page.tsx` to load the real payment.

Required query:

- Find `payment` by `uid`.
- Select only safe fields.
- Select booking fields needed by UI.
- Select event type fields needed by `getPaymentAppData`.
- Select profile/theme/branding fields.

Use Prisma `select`, not `include`.

Do not expose `credential.key`.

### Webhooks

Add provider webhooks:

- `packages/app-store/wompi/api/webhook.ts`
- `packages/app-store/bold/api/webhook.ts`
- `apps/web/pages/api/integrations/wompi/webhook.ts`
- `apps/web/pages/api/integrations/bold/webhook.ts`

Each webhook must:

1. Require `POST`.
2. Read raw body.
3. Validate provider signature.
4. Parse provider event safely with Zod or a typed parser.
5. Find `Payment` by `externalId` or provider reference.
6. Ignore duplicate success if `payment.success` is already true.
7. Call `handlePaymentSuccess` for successful payment.
8. Record failure/cancelled data without marking the booking paid.
9. Return `200` for duplicate or unknown-but-acknowledged events when safe.
10. Return `400` for invalid signatures.

## UI Design

### Event Type Settings

Create app cards similar to existing payment apps.

Controls:

- Enable payment.
- Price.
- Currency.
- Payment option.
- Refund policy if supported.

For MVP, disable `HOLD` for Wompi and Bold unless the provider implementation supports card authorization/capture safely.

### Payment Page

Extend `PaymentPage.tsx` with:

- `WompiPaymentComponent`
- `BoldPaymentComponent`

Wompi can use Web Checkout by rendering a form or redirect button to `https://checkout.wompi.co/p/` with required hidden fields.

Bold can load the Bold checkout script and open checkout using safe values from `Payment.data`.

The page should:

- Show real booking details.
- Show amount and currency from `Payment`.
- Show paid/refunded state.
- Offer retry if the gateway flow supports retry.
- Avoid showing secrets.

## Payment Creation

Wompi `PaymentService.create` should:

1. Validate credentials.
2. Generate a stable provider reference.
3. Generate Wompi integrity signature server-side.
4. Create `Payment` with `success: false`.
5. Store only client-safe checkout data in `Payment.data`.
6. Return the `Payment`.

Bold `PaymentService.create` should:

1. Validate credentials.
2. Generate a stable provider reference.
3. Generate Bold integrity signature server-side.
4. Create `Payment` with `success: false`.
5. Store only client-safe checkout data in `Payment.data`.
6. Return the `Payment`.

## Payment Success

Always use `handlePaymentSuccess`.

Do not duplicate the booking-confirmation behavior in each gateway. Provider-specific code should only verify provider authenticity and map provider status to Cal.diy payment state.

## Error Handling

- Use `ErrorWithCode` in services and utilities.
- Use `HttpError` or current API-route error conventions in API handlers.
- Do not use `TRPCError` outside tRPC routers.
- Do not swallow invalid signature errors.
- Do not mark bookings paid from client callbacks.

## Security Requirements

- Never expose `credential.key`.
- Do not store private keys, webhook secrets, or integrity secrets in `Payment.data`.
- Use constant-time comparison for signatures.
- Read raw body for webhook validation.
- Enforce `POST` for webhooks.
- Make webhook processing idempotent.
- Use `select` in Prisma queries.
- Treat client redirect URLs as informational only.

## Edge Cases

- Duplicate webhook delivery.
- Payment success arrives after awaiting-payment email was scheduled.
- Attendee returns from checkout before webhook arrives.
- Provider says failed after an earlier success.
- Booking is cancelled before payment succeeds.
- Event type payment app disabled after payment creation.
- Rescheduled paid bookings.
- Seated event bookings.
- Team event credentials.
- Currency unsupported by provider.
- Missing credential selected in event metadata.

## Out of Scope for MVP

- Manual refunds through Wompi or Bold.
- `HOLD` / no-show fee support.
- Split payments.
- Multi-gateway selection on a single payment page.
- Using `payments-hub` as a required production runtime dependency.
- Supporting all Wompi transaction API payment methods directly.
- Bold API Pagos en Linea beta integration.

