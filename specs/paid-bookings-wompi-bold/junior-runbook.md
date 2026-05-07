# Junior Engineer Runbook

## How to Work on This Feature

Work on one PR at a time. Keep diffs small. If a task touches more than 10 code files, stop and ask the tech lead how to split it.

Do not edit generated files manually. If a file says it is generated, find the generation command and run it.

Do not add dependencies without approval.

Do not change `packages/prisma/schema.prisma` unless the tech lead explicitly approves a schema change.

## Before Coding

1. Read [README.md](./README.md).
2. Read [design.md](./design.md).
3. Read the PR section assigned to you in [implementation.md](./implementation.md).
4. Search for an existing app that resembles your task:

```bash
rg -n "BuildPaymentService|PaymentService|EventTypeAppSettingsInterface" packages/app-store
```

5. For payment page work, inspect:

```bash
rg -n "PaymentPage|paymentUid|createPaymentLink" apps packages
```

6. For webhook work, inspect:

```bash
rg -n "handlePaymentSuccess|getRawBody|bodyParser: false" apps packages
```

## Coding Rules

- Use `select` in Prisma queries.
- Use `import type` for TypeScript type imports.
- Import directly from source files, not barrels.
- Add UI strings to `packages/i18n/locales/en/common.json`.
- Use `ErrorWithCode` in services/utilities where practical.
- Keep comments rare and only explain why.
- Never use `as any`.
- Never expose `credential.key`.

## PR 1 Checklist: Payment Page Loader

1. Open `apps/web/app/(use-page-wrapper)/payment/[uid]/page.tsx`.
2. Replace dummy `getData` with a real data loader.
3. Query payment by `uid`.
4. Use `select`.
5. Return safe props for `PaymentPage`.
6. Handle missing payment.
7. Run type check for touched files if available.
8. Manually open a known payment URL if local data exists.

Common mistake: selecting credential relations. Do not do that.

## PR 3 or 6 Checklist: App Metadata and UI

1. Copy structure from an existing payment app, not from a calendar app.
2. Create `_metadata.ts`.
3. Create `zod.ts`.
4. Create setup page/component.
5. Create event type app card/settings.
6. Add translation keys.
7. Run app-store generation.
8. Verify generated files changed only because generation ran.

Common mistake: adding text directly in JSX. Use translations.

## PR 4 or 7 Checklist: PaymentService

1. Implement provider credential schema.
2. Parse credentials in constructor.
3. Implement `create`.
4. Create provider reference.
5. Generate provider signature/hash server-side.
6. Create `Payment`.
7. Store only safe values in `Payment.data`.
8. Return created payment.
9. Implement unsupported methods clearly:
   - `HOLD`
   - `refund`
   - `chargeCard`
10. Add unit tests for signatures.

Common mistake: storing secret keys in `Payment.data`. Do not do that.

## PR 5 or 8 Checklist: Webhook

1. Add provider API handler.
2. Add route export under `apps/web/pages/api/integrations/{provider}/webhook.ts`.
3. Disable Next body parser.
4. Read raw body.
5. Validate signature before trusting payload.
6. Parse payload with Zod or typed parser.
7. Find payment safely.
8. Check idempotency.
9. Call `handlePaymentSuccess` only on confirmed success.
10. Add tests.

Common mistake: marking booking paid from redirect/callback. Only webhook success should mark paid.

## Local Verification

Run focused commands first:

```bash
yarn biome check --write <changed-files>
```

Then before PR:

```bash
yarn biome check --write .
yarn type-check:ci --force
TZ=UTC yarn test
```

If `yarn type-check:ci --force` fails, inspect whether the failure is in your touched files. Do not assume it is unrelated until after running it.

## What to Put in the PR Description

Use this template:

```md
## What changed

- 

## Why

- 

## Testing

- [ ] yarn biome check --write .
- [ ] yarn type-check:ci --force
- [ ] TZ=UTC yarn test
- [ ] Manual paid booking flow

## Notes

- 
```

Create PRs as draft by default.

## When to Ask for Help

Ask the tech lead before:

- Adding a dependency.
- Changing Prisma schema.
- Changing generated files manually.
- Supporting refunds.
- Supporting `HOLD`.
- Changing existing payment behavior for PayPal, Alby, HitPay, BTCPay, or Stripe.
- Making `payments-hub` a runtime dependency.

