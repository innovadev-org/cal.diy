# Gateway Details

## Source Code Reference

Use `/Users/eagarcia/Projects/innovatex/marketplace/payments-hub` as a reference, not as a runtime dependency.

Useful reference files:

- `src/main/java/shop/andevs/payments/service/gateway/WompiGatewayPreprocessor.java`
- `src/main/java/shop/andevs/payments/service/webhook/wompi/WompiWebhookHandler.java`
- `src/main/java/shop/andevs/payments/service/webhook/wompi/WompiWebhookParser.java`
- `src/main/java/shop/andevs/payments/service/gateway/BoldGatewayPreprocessor.java`
- `src/main/java/shop/andevs/payments/service/webhook/bold/BoldWebhookHandler.java`
- `src/main/java/shop/andevs/payments/service/webhook/bold/BoldWebhookParser.java`
- `src/main/java/shop/andevs/payments/model/PaymentIntent.java`

## Wompi

### Official References

- Checkout: https://docs.wompi.co/en/docs/colombia/widget-checkout-web/
- Events: https://docs.wompi.co/en/docs/colombia/eventos/

### Checkout Integration

Use Wompi Web Checkout first.

Required checkout fields:

- `public-key`
- `currency`
- `amount-in-cents`
- `reference`
- `signature:integrity`

Optional useful fields:

- `redirect-url`
- customer email/name fields if supported by the chosen checkout mode

### Amount Rules

Wompi expects amount in cents.

Example:

- `$100 COP` becomes `10000`.
- `Payment.amount` must already be understood before conversion. Confirm whether Cal.diy stored amount is already smallest-unit for the configured currency.
- Do not double-convert.

Add tests for:

- `1000 COP`
- `1000.50` if decimal input can reach the helper
- zero and negative values rejected before provider call

### Integrity Signature

Generate server-side only.

Formula:

```text
<reference><amount-in-cents><currency><integritySecret>
```

If using expiration time, Wompi requires:

```text
<reference><amount-in-cents><currency><expirationDate><integritySecret>
```

Hash with SHA256 and return lowercase hex.

### Payment.data Shape

Store only safe checkout data:

```json
{
  "provider": "wompi",
  "environment": "sandbox",
  "reference": "cal_...",
  "publicKey": "pub_test_...",
  "amountInCents": "100000",
  "currency": "COP",
  "integritySignature": "hex...",
  "checkoutUrl": "https://checkout.wompi.co/p/",
  "redirectUrl": "https://..."
}
```

Never store:

- `privateKey`
- `integritySecret`
- `eventSecret`

### Webhook Signature

Do not copy `payments-hub` Wompi webhook validation directly.

The local Java implementation checks `X-Signature` and validates HMAC over raw body. Current Wompi docs describe:

- `X-Event-Checksum`
- `signature.checksum`
- `signature.properties`
- event secret
- SHA256 over concatenated property values plus the event secret

Expected algorithm:

1. Parse raw JSON.
2. Read `signature.properties`.
3. For each property path, extract that value from the event in listed order.
4. Concatenate values without separators.
5. Append event secret.
6. SHA256 hash the string.
7. Compare with `X-Event-Checksum` or `signature.checksum` in constant time.

### Status Mapping

Wompi event type is commonly `transaction.updated`.

Map transaction status:

- `APPROVED` -> call `handlePaymentSuccess`.
- `DECLINED` -> failed.
- `ERROR` -> failed.
- `VOIDED` -> cancelled/voided.
- `PENDING` -> record only, keep unpaid.

### Payment Lookup

Find by:

1. `Payment.externalId` equal to Wompi transaction reference.
2. If needed, fallback to `Payment.data.reference`.

Prefer storing the checkout reference in both `externalId` and `Payment.data.reference` for simple lookup.

## Bold

### Official References

- Payment button: https://developers.bold.co/products/payment-button
- Webhook: https://developers.bold.co/products/webhook

### Checkout Integration

Use Bold payment button / custom checkout first.

Required or important fields when amount is defined:

- `apiKey`
- `amount`
- `currency`
- `orderId`
- `integritySignature`
- `redirectionUrl`

### Amount Rules

Bold button amount is sent without decimals.

Example:

- `$95,000 COP` should be `95000`.

Confirm how Cal.diy `Payment.amount` is stored for COP before sending it to Bold. Add tests to prevent double conversion.

### Integrity Hash

Generate server-side only.

Formula:

```text
{orderId}{amount}{currency}{secretKey}
```

Hash with SHA256 and return lowercase hex.

This matches the `payments-hub` implementation in `BoldGatewayPreprocessor.java`.

### Payment.data Shape

Store only safe checkout data:

```json
{
  "provider": "bold",
  "environment": "sandbox",
  "orderId": "cal_...",
  "apiKey": "identity_key",
  "amount": "95000",
  "currency": "COP",
  "integritySignature": "hex...",
  "redirectionUrl": "https://..."
}
```

Never store:

- `secretKey`

### Webhook Signature

Bold sends `x-bold-signature`. Bold uses the same `identityKey` ("Llave de identidad") for both the payment button and webhook signing. There is no separate webhook secret.

Expected validation:

1. Read raw request body.
2. Convert raw body string to Base64.
3. Create HMAC-SHA256 over that Base64 string using `identityKey`.
4. Return lowercase hex.
5. Compare with `x-bold-signature` in constant time.

Reference: https://developers.bold.co/products/webhook

### Status Mapping

Map event type:

- `SALE_APPROVED` -> call `handlePaymentSuccess`.
- `SALE_REJECTED` -> failed.
- `VOID_APPROVED` -> cancelled/voided.
- `VOID_REJECTED` -> record only.

### Payment Lookup

Find by:

1. `Payment.externalId` equal to Bold `orderId`.
2. If webhook payload uses `metadata.reference`, store Cal.diy `Payment.externalId` there too.
3. Avoid relying on `Payment.id` in provider metadata unless explicitly stored.

## Shared Provider Rules

### Idempotency

Before calling `handlePaymentSuccess`:

1. Load payment by provider reference.
2. If no payment, acknowledge only when provider retrying would not help.
3. If `payment.success` is already true, return `200`.
4. If booking is cancelled, do not automatically revive it. Record event and return `200`; escalate with logs.

### Failure Storage

For failed provider events, update only safe data:

```json
{
  "lastEvent": {
    "providerStatus": "DECLINED",
    "providerEventId": "evt_...",
    "receivedAt": "2026-05-07T00:00:00.000Z"
  }
}
```

Do not add a new `PaymentStatus` column for MVP.

### Refunds

Initial provider implementations may return `null` or throw a clear unsupported error for `refund`.

Do not show refund actions in UI for Wompi/Bold until provider refund support is implemented and tested.

### HOLD / No-show Fees

Disable `HOLD` for both Wompi and Bold in MVP.

Reason: Cal.diy `HOLD` expects card collection and delayed capture semantics. Wompi Web Checkout and Bold payment button do not provide the same generic behavior without extra provider-specific implementation.

