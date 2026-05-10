# Paid Bookings with Wompi and Bold Implementation

## Status: not-started

This plan is intentionally split into small PRs. Do not combine Wompi and Bold implementation into one PR. Do not change Prisma schema unless an owner approves it.

## PR 1: Repair Generic Paid Booking Page

### Goal

Make `/payment/[uid]` load real payment data and render existing payment apps correctly.

### Files

- `apps/web/app/(use-page-wrapper)/payment/[uid]/page.tsx`
- `apps/web/app/(use-page-wrapper)/payment/[uid]/PaymentPage.tsx`
- Optional repository helper under `packages/features/bookings/repositories/`
- Tests near the changed code if patterns exist.

### Tasks

1. Replace placeholder props in `page.tsx` with a Prisma query by `payment.uid`.
2. Use `select`, not `include`.
3. Select:
   - payment: `id`, `uid`, `success`, `refunded`, `amount`, `currency`, `paymentOption`, `data`, `appId`
   - booking: `id`, `uid`, `title`, `startTime`, `endTime`, `status`, `paid`, `location`
   - event type: `id`, `title`, `length`, `price`, `currency`, `metadata`, `successRedirectUrl`, `forwardParamsSuccessRedirect`, `recurringEvent`
   - profile/theme/branding fields needed by page
4. Return 404 or a safe unavailable state if the payment does not exist.
5. Ensure no credential data is selected.
6. Keep existing PayPal, Alby, HitPay, and BTCPay rendering working.

### Acceptance Criteria

- Opening `/payment/{realPaymentUid}` renders actual booking/payment details.
- Opening an unknown UID does not render dummy data.
- No secrets are returned to the client.
- Type check passes for changed files.

## PR 2: Add Shared Gateway Payment Helpers

### Goal

Create reusable utilities for gateway payment apps without touching provider behavior.

### Suggested Files

- `packages/app-store/_utils/payments/createPaymentLink.ts`
- `packages/app-store/_utils/payments/paymentDataSchemas.ts`
- `packages/app-store/_utils/payments/paymentWebhook.ts`

### Tasks

1. Move or generalize `createPaymentLink` out of `stripepayment/lib/client`.
2. Keep existing imports working or update them in a focused diff.
3. Add helper for constant-time string comparison if no shared helper exists.
4. Add helper for reading raw request bodies if existing provider APIs repeat it.
5. Add narrow tests for helper behavior.

### Acceptance Criteria

- Existing awaiting payment email still builds the same link.
- Existing booking redirect still sends attendees to `/payment/{uid}`.
- No generated files are manually edited.

## PR 3: Add Wompi App Metadata and Settings UI

### Goal

Let users install Wompi and configure event-type payment settings.

### Files

- `packages/app-store/wompi/_metadata.ts`
- `packages/app-store/wompi/index.ts`
- `packages/app-store/wompi/package.json`
- `packages/app-store/wompi/zod.ts`
- `packages/app-store/wompi/api/add.ts`
- `packages/app-store/wompi/api/index.ts`
- `packages/app-store/wompi/components/EventTypeAppCardInterface.tsx`
- `packages/app-store/wompi/components/EventTypeAppSettingsInterface.tsx`
- `packages/app-store/wompi/pages/setup/_getServerSideProps.tsx`
- `apps/web/components/apps/wompi/Setup.tsx`
- `packages/i18n/locales/en/common.json`

### Tasks

1. Model Wompi credentials with Zod.
2. Add setup form for:
   - public key
   - private key
   - integrity secret
   - event secret
   - environment
3. Add event settings:
   - enabled
   - price
   - currency
   - payment option
   - refund policy
4. Support `COP` first.
5. Disable `HOLD` for MVP.
6. Add all UI strings to English translations.
7. Run the app-store generation command used by this repo.

### Acceptance Criteria

- Wompi appears as a payment app.
- Credentials are stored in `Credential.key`.
- Event type can enable Wompi payment.
- Only one payment app can be enabled for an event type.
- No generated files are edited manually before running generation.

## PR 4: Implement Wompi Payment Creation and Payment Page Component

### Goal

Create Wompi payments and let attendees start Wompi checkout.

### Files

- `packages/app-store/wompi/lib/PaymentService.ts`
- `packages/app-store/wompi/lib/signature.ts`
- `packages/app-store/wompi/lib/wompiCredentialKeysSchema.ts`
- `apps/web/components/apps/wompi/WompiPaymentComponent.tsx`
- `apps/web/app/(use-page-wrapper)/payment/[uid]/PaymentPage.tsx`

### Tasks

1. Implement `BuildPaymentService`.
2. Implement `create`.
3. Reject `HOLD` with `ErrorWithCode` or a typed error.
4. Convert Cal.diy amount correctly for Wompi.
5. Generate `signature:integrity` server-side.
6. Create `Payment` with:
   - `appId: wompi`
   - `success: false`
   - `refunded: false`
   - `fee: 0`
   - `externalId` equal to the Wompi reference used in checkout
   - `data` containing only public checkout data
7. Render a Wompi checkout form/button.
8. Use `Payment.amount`, not event type price, on the payment page.

### Acceptance Criteria

- Paid booking with Wompi creates a `Payment` record.
- Attendee lands on `/payment/{uid}`.
- Wompi payment page shows a usable checkout action.
- Secret fields are not present in serialized props or `Payment.data`.

## PR 5: Implement Wompi Webhook

### Goal

Confirm Wompi payments from server-side events.

### Files

- `packages/app-store/wompi/api/webhook.ts`
- `apps/web/pages/api/integrations/wompi/webhook.ts`
- `packages/app-store/wompi/lib/webhook.ts`
- `packages/app-store/wompi/lib/webhook.test.ts`

### Tasks

1. Read raw request body.
2. Validate Wompi event checksum using official Wompi event validation:
   - use `X-Event-Checksum` or `signature.checksum`
   - use `signature.properties`
   - append event secret
   - hash with SHA256
3. Parse transaction status.
4. Find `Payment` by provider reference.
5. If status is `APPROVED`, call `handlePaymentSuccess`.
6. If status is `DECLINED`, `ERROR`, or `VOIDED`, update `Payment.data` with safe status details but do not mark booking paid.
7. Make duplicate success idempotent.

### Acceptance Criteria

- Valid Wompi approved event marks booking paid.
- Invalid checksum returns `400`.
- Duplicate approved event does not send duplicate booking confirmation.
- Failed event does not mark booking paid.

## PR 6: Add Bold App Metadata and Settings UI

### Goal

Let users install Bold and configure event-type payment settings.

### Files

- `packages/app-store/bold/_metadata.ts`
- `packages/app-store/bold/index.ts`
- `packages/app-store/bold/package.json`
- `packages/app-store/bold/zod.ts`
- `packages/app-store/bold/api/add.ts`
- `packages/app-store/bold/api/index.ts`
- `packages/app-store/bold/components/EventTypeAppCardInterface.tsx`
- `packages/app-store/bold/components/EventTypeAppSettingsInterface.tsx`
- `packages/app-store/bold/pages/setup/_getServerSideProps.tsx`
- `apps/web/components/apps/bold/Setup.tsx`
- `packages/i18n/locales/en/common.json`

### Tasks

1. Model Bold credentials with Zod.
2. Add setup form for:
   - identity key (used for both checkout init and webhook signing)
   - secret key
   - environment
3. Add event settings:
   - enabled
   - price
   - currency
   - payment option
   - refund policy
4. Support `COP` first.
5. Disable `HOLD` for MVP.
6. Add all UI strings to English translations.
7. Run the app-store generation command used by this repo.

### Acceptance Criteria

- Bold appears as a payment app.
- Credentials are stored in `Credential.key`.
- Event type can enable Bold payment.
- Only one payment app can be enabled for an event type.

## PR 7: Implement Bold Payment Creation and Payment Page Component

### Goal

Create Bold payments and let attendees open Bold checkout.

### Files

- `packages/app-store/bold/lib/PaymentService.ts`
- `packages/app-store/bold/lib/signature.ts`
- `packages/app-store/bold/lib/boldCredentialKeysSchema.ts`
- `apps/web/components/apps/bold/BoldPaymentComponent.tsx`
- `apps/web/app/(use-page-wrapper)/payment/[uid]/PaymentPage.tsx`

### Tasks

1. Implement `BuildPaymentService`.
2. Implement `create`.
3. Reject `HOLD` for MVP.
4. Generate Bold integrity hash server-side with `{orderId}{amount}{currency}{secretKey}`.
5. Create `Payment` with:
   - `appId: bold`
   - `success: false`
   - `refunded: false`
   - `fee: 0`
   - `externalId` equal to the Bold `orderId`
   - `data` containing only public checkout data
6. Render Bold checkout using the official Bold script or redirect mode.
7. Do not expose `secretKey` in serialized props or `Payment.data`.

### Acceptance Criteria

- Paid booking with Bold creates a `Payment` record.
- Attendee lands on `/payment/{uid}`.
- Bold checkout opens with the right amount and reference.
- Secret fields are not present in serialized props or `Payment.data`.

## PR 8: Implement Bold Webhook

### Goal

Confirm Bold payments from server-side events.

### Files

- `packages/app-store/bold/api/webhook.ts`
- `apps/web/pages/api/integrations/bold/webhook.ts`
- `packages/app-store/bold/lib/webhook.ts`
- `packages/app-store/bold/lib/webhook.test.ts`

### Tasks

1. Read raw request body.
2. Validate `x-bold-signature`.
3. Use Base64(rawBody) as the HMAC message.
4. Use HMAC-SHA256 with the Bold `identityKey` (Bold reuses the identity key for webhook signing).
5. Compare in constant time.
6. Parse event type.
7. Map success:
   - `SALE_APPROVED` means paid.
8. Map failure:
   - `SALE_REJECTED` means failed.
   - `VOID_APPROVED` means cancelled/voided.
9. Find `Payment` by `externalId` / `orderId` / metadata reference.
10. Call `handlePaymentSuccess` only for successful payment.
11. Make duplicate success idempotent.

### Acceptance Criteria

- Valid Bold approved event marks booking paid.
- Invalid signature returns `400`.
- Duplicate approved event does not send duplicate booking confirmation.
- Failed event does not mark booking paid.

## PR 9: End-to-End Hardening

### Goal

Verify complete paid booking flows and fix cross-cutting issues.

### Tasks

1. Test Wompi paid booking manually.
2. Test Bold paid booking manually.
3. Test unpaid event booking still works.
4. Test missing credentials error.
5. Test only one payment app can be enabled.
6. Test awaiting payment reminder link.
7. Test booking cancellation before payment.
8. Verify app-store generated files are correct.
9. Run type checks and focused tests.

### Acceptance Criteria

- Wompi and Bold pass manual QA.
- Relevant unit tests pass.
- `yarn type-check:ci --force` passes or failures are documented as unrelated only after running it.
- PRs stay under the repo size guidance.

## Completed

None yet.

## In Progress

Planning only.

## Blocked

- Confirm final provider credential names with product/ops.
- Confirm whether MVP must support only `COP` or also `USD` for Bold.
- Confirm whether Wompi and Bold sandbox accounts are available.

## Next Steps

1. Assign PR 1 to one engineer.
2. Assign PR 2 to one engineer after PR 1 is reviewed.
3. Start Wompi UI and service after PR 2 lands.
4. Start Bold after Wompi patterns are established.

