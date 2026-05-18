# Testing Plan

## Principles

- Test provider signing functions with deterministic inputs.
- Test webhook handlers without calling real provider APIs.
- Test booking/payment integration through the existing Cal.diy service layer.
- Keep tests focused and close to changed files.
- Do not require live credentials in CI.

## Unit Tests

### Wompi Signature

Test file suggestion:

- `packages/app-store/wompi/lib/signature.test.ts`

Cases:

- Generates expected integrity signature for reference, amount, currency, and integrity secret.
- Generates expected integrity signature with expiration date if implemented.
- Rejects missing integrity secret.
- Preserves exact value order.
- Does not accept lowercase currency if provider requires uppercase.

### Wompi Webhook

Test file suggestion:

- `packages/app-store/wompi/lib/webhook.test.ts`

Cases:

- Valid checksum passes.
- Invalid checksum fails.
- `X-Event-Checksum` and `signature.checksum` are both supported if implemented.
- Missing signature fails.
- `APPROVED` maps to paid.
- `DECLINED`, `ERROR`, and `VOIDED` do not map to paid.
- Unknown event is acknowledged but does not mark paid.

### Bold Signature

Test file suggestion:

- `packages/app-store/bold/lib/signature.test.ts`

Cases:

- Generates expected integrity hash for `orderId + amount + currency + secretKey`.
- Uses amount without decimal places.
- Rejects missing secret key.
- Preserves exact value order.

### Bold Webhook

Test file suggestion:

- `packages/app-store/bold/lib/webhook.test.ts`

Cases:

- Valid `x-bold-signature` passes.
- Invalid signature fails.
- Base64(rawBody) is used as HMAC message.
- `SALE_APPROVED` maps to paid.
- `SALE_REJECTED` and `VOID_APPROVED` do not mark paid.
- Unknown event is acknowledged but does not mark paid.

## Service Tests

### PaymentService.create

For Wompi and Bold:

- Creates a `Payment` row.
- Sets `appId` correctly.
- Sets `externalId` to provider reference.
- Sets `success: false`.
- Sets `refunded: false`.
- Stores only public checkout data in `data`.
- Throws clear error on malformed credentials.
- Throws or rejects `HOLD`.

### handlePayment Integration

Add or extend tests around:

- `packages/features/bookings/lib/handlePayment.test.ts`

Cases:

- New payment app is resolved from generated `PaymentServiceMap`.
- Add-on booking field prices are included.
- Missing payment service results in controlled failure, not a silent successful booking.

## API Route Tests

For each provider webhook:

- Rejects non-POST methods.
- Reads raw body.
- Rejects invalid signature with `400`.
- Returns `200` for duplicate success.
- Calls `handlePaymentSuccess` exactly once for valid success.
- Does not call `handlePaymentSuccess` for failed/cancelled events.

## Manual QA

### Setup QA

1. Start local app.
2. Log in as a host.
3. Install Wompi app.
4. Install Bold app.
5. Confirm credentials are saved.
6. Confirm app settings are not visible to attendees.

### Wompi Booking QA

1. Create event type.
2. Enable Wompi payment.
3. Set price in COP.
4. Open public booking link.
5. Select slot.
6. Submit attendee form.
7. Confirm booking response includes `paymentRequired: true`.
8. Confirm redirect to `/payment/{uid}`.
9. Confirm payment page displays correct event, date, amount, currency.
10. Open Wompi checkout.
11. Complete sandbox payment.
12. Deliver Wompi webhook.
13. Confirm `Payment.success = true`.
14. Confirm `Booking.paid = true`.
15. Confirm booking status is expected.
16. Confirm attendee/host confirmation communication is sent.
17. Confirm `BOOKING_PAID` webhook is emitted if configured.

### Bold Booking QA

Repeat Wompi QA using Bold.

### Regression QA

1. Free event booking still works.
2. Existing PayPal payment page still works if configured.
3. Existing BTCPay/Alby/HitPay payment page still compiles.
4. Event type with no payment app does not show price.
5. Event type cannot enable Wompi and Bold at the same time.
6. Missing credentials gives a clear error.
7. Cancelled booking is not confirmed by late payment without explicit decision.

## Security QA

Inspect serialized payment page props.

Must not contain:

- Wompi private key.
- Wompi integrity secret.
- Wompi event secret.
- Bold secret key.
- Bold identity key (used for both checkout init and webhook HMAC signing).
- Any `credential.key`.

Inspect `Payment.data`.

Must not contain provider secrets.

## Commands

Use focused tests during development, then broader checks before PR.

```bash
yarn biome check --write .
yarn type-check:ci --force
TZ=UTC yarn test
```

If tests require generated app-store files, run the project app-store generation command first. Do not manually edit generated files.

## Acceptance Checklist

- [ ] Wompi checkout signature unit tests pass.
- [ ] Wompi webhook signature unit tests pass.
- [ ] Bold checkout hash unit tests pass.
- [ ] Bold webhook signature unit tests pass.
- [ ] Payment page loader test or manual verification passes.
- [ ] Paid booking manual flow passes for Wompi.
- [ ] Paid booking manual flow passes for Bold.
- [ ] Free booking regression passes.
- [ ] Type check passes.
- [ ] Biome passes.

