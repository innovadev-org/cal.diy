import { createHmac } from "node:crypto";
import { constantTimeEqual, parseJsonRawBody } from "@calcom/app-store/_utils/payments/paymentWebhook";
import { z } from "zod";

const boldMetadataSchema = z
  .object({
    reference: z.string().min(1).nullable().optional(),
  })
  .passthrough();

const boldWebhookDataSchema = z
  .object({
    metadata: boldMetadataSchema,
    payment_id: z
      .union([z.string(), z.number()])
      .optional()
      .transform((value) => (value ? String(value) : null)),
    merchant_id: z
      .union([z.string(), z.number()])
      .optional()
      .transform((value) => (value ? String(value) : null)),
    created_at: z.string().optional(),
    payment_method: z.string().optional(),
    amount: z
      .object({
        total: z.union([z.string(), z.number()]).optional(),
      })
      .passthrough()
      .optional(),
    card: z
      .object({
        franchise: z.string().optional(),
        capture_mode: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const boldWebhookPayloadSchema = z
  .object({
    id: z
      .union([z.string(), z.number()])
      .optional()
      .transform((value) => (value ? String(value) : null)),
    type: z.string().min(1),
    subject: z.string().optional(),
    data: boldWebhookDataSchema,
  })
  .passthrough();

export type BoldWebhookPayload = z.infer<typeof boldWebhookPayloadSchema>;

export function parseBoldWebhookPayload(rawBody: Buffer): BoldWebhookPayload {
  return boldWebhookPayloadSchema.parse(parseJsonRawBody<unknown>(rawBody));
}

export function getBoldSignatureFromHeader(headerValue: string | string[] | undefined): string | null {
  if (typeof headerValue === "string") return headerValue;
  if (Array.isArray(headerValue)) return headerValue[0] ?? null;
  return null;
}

export function createBoldWebhookSignature({
  rawBody,
  webhookSecret,
}: {
  rawBody: Buffer;
  webhookSecret: string;
}) {
  const base64Body = rawBody.toString("base64");
  return createHmac("sha256", webhookSecret).update(base64Body).digest("hex");
}

export function verifyBoldWebhookSignature({
  rawBody,
  webhookSecret,
  signature,
}: {
  rawBody: Buffer;
  webhookSecret: string;
  signature: string;
}): boolean {
  const computedSignature = createBoldWebhookSignature({ rawBody, webhookSecret });
  return constantTimeEqual(computedSignature, signature, "hex");
}

export function getBoldReference(payload: BoldWebhookPayload): string | null {
  return payload.data.metadata.reference ?? null;
}

export function isBoldApprovedType(type: string): boolean {
  return type.toUpperCase() === "SALE_APPROVED";
}

export function isBoldFailedType(type: string): boolean {
  return ["SALE_REJECTED", "VOID_APPROVED"].includes(type.toUpperCase());
}

export function shouldStoreBoldEventOnly(type: string): boolean {
  return type.toUpperCase() === "VOID_REJECTED";
}

export function getBoldWebhookAttributes(payload: BoldWebhookPayload) {
  return {
    eventId: payload.id,
    type: payload.type,
    subject: payload.subject ?? null,
    paymentId: payload.data.payment_id,
    merchantId: payload.data.merchant_id,
    createdAt: payload.data.created_at ?? null,
    paymentMethod: payload.data.payment_method ?? null,
    amountTotal: payload.data.amount?.total ? String(payload.data.amount.total) : null,
    cardFranchise: payload.data.card?.franchise ?? null,
    cardCaptureMode: payload.data.card?.capture_mode ?? null,
  };
}
