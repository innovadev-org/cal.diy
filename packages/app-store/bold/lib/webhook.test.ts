import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createBoldWebhookSignature,
  getBoldReference,
  getBoldSignatureFromHeader,
  getBoldWebhookAttributes,
  isBoldApprovedType,
  isBoldFailedType,
  parseBoldWebhookPayload,
  shouldStoreBoldEventOnly,
  verifyBoldWebhookSignature,
} from "./webhook";

describe("Bold webhook helpers", () => {
  const webhookSecret = "test_webhook_secret";
  const payload = {
    id: "evt_123",
    type: "SALE_APPROVED",
    subject: "payment",
    data: {
      payment_id: "pay_123",
      merchant_id: "merchant_123",
      created_at: "2026-05-07T12:00:00Z",
      payment_method: "CREDIT_CARD",
      amount: {
        total: "25000",
      },
      card: {
        franchise: "VISA",
        capture_mode: "automatic",
      },
      metadata: {
        reference: "payment_ref_123",
      },
    },
  };

  it("parses Bold references from metadata", () => {
    const parsedPayload = parseBoldWebhookPayload(Buffer.from(JSON.stringify(payload)));

    expect(getBoldReference(parsedPayload)).toBe("payment_ref_123");
  });

  it("allows webhook payloads without a Cal.diy reference", () => {
    const parsedPayload = parseBoldWebhookPayload(
      Buffer.from(
        JSON.stringify({
          ...payload,
          data: {
            ...payload.data,
            metadata: {
              reference: null,
            },
          },
        })
      )
    );

    expect(getBoldReference(parsedPayload)).toBeNull();
  });

  it("validates HMAC signatures over the base64 raw body", () => {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac("sha256", webhookSecret).update(rawBody.toString("base64")).digest("hex");

    expect(createBoldWebhookSignature({ rawBody, webhookSecret })).toBe(signature);
    expect(verifyBoldWebhookSignature({ rawBody, webhookSecret, signature })).toBe(true);
  });

  it("rejects invalid signatures", () => {
    const rawBody = Buffer.from(JSON.stringify(payload));

    expect(
      verifyBoldWebhookSignature({
        rawBody,
        webhookSecret,
        signature: "0".repeat(64),
      })
    ).toBe(false);
  });

  it("reads signature headers", () => {
    expect(getBoldSignatureFromHeader("abc")).toBe("abc");
    expect(getBoldSignatureFromHeader(["abc", "def"])).toBe("abc");
    expect(getBoldSignatureFromHeader(undefined)).toBeNull();
  });

  it("maps terminal event types", () => {
    expect(isBoldApprovedType("SALE_APPROVED")).toBe(true);
    expect(isBoldFailedType("SALE_REJECTED")).toBe(true);
    expect(isBoldFailedType("VOID_APPROVED")).toBe(true);
    expect(isBoldFailedType("VOID_REJECTED")).toBe(false);
    expect(shouldStoreBoldEventOnly("VOID_REJECTED")).toBe(true);
  });

  it("extracts safe webhook attributes", () => {
    const parsedPayload = parseBoldWebhookPayload(Buffer.from(JSON.stringify(payload)));

    expect(getBoldWebhookAttributes(parsedPayload)).toEqual({
      eventId: "evt_123",
      type: "SALE_APPROVED",
      subject: "payment",
      paymentId: "pay_123",
      merchantId: "merchant_123",
      createdAt: "2026-05-07T12:00:00Z",
      paymentMethod: "CREDIT_CARD",
      amountTotal: "25000",
      cardFranchise: "VISA",
      cardCaptureMode: "automatic",
    });
  });
});
