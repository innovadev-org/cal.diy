import { createHash } from "node:crypto";
import { constantTimeEqual, parseJsonRawBody } from "@calcom/app-store/_utils/payments/paymentWebhook";
import { z } from "zod";

const wompiSignatureSchema = z.object({
  properties: z.array(z.string()).min(1),
  checksum: z.string().min(1),
});

const wompiTransactionSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    reference: z.string().min(1),
    status: z.string().min(1),
    amount_in_cents: z.number().optional(),
    currency: z.string().optional(),
  })
  .passthrough();

const wompiWebhookPayloadSchema = z
  .object({
    event: z.string().optional(),
    data: z
      .object({
        transaction: wompiTransactionSchema,
      })
      .passthrough(),
    signature: wompiSignatureSchema.optional(),
    timestamp: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

type JsonRecord = Record<string, unknown>;

export type WompiWebhookPayload = z.infer<typeof wompiWebhookPayloadSchema>;
export type WompiTransaction = z.infer<typeof wompiTransactionSchema>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPathValue(source: unknown, path: string): string | null {
  const value = path.split(".").reduce<unknown>((currentValue, key) => {
    if (!isRecord(currentValue)) return undefined;
    return currentValue[key];
  }, source);

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function parseWompiWebhookPayload(rawBody: Buffer): WompiWebhookPayload {
  return wompiWebhookPayloadSchema.parse(parseJsonRawBody<unknown>(rawBody));
}

export function getWompiEventChecksumFromHeader(headerValue: string | string[] | undefined): string | null {
  if (typeof headerValue === "string") return headerValue;
  if (Array.isArray(headerValue)) return headerValue[0] ?? null;
  return null;
}

export function getWompiTransaction(payload: WompiWebhookPayload): WompiTransaction {
  return payload.data.transaction;
}

export function verifyWompiEventChecksum({
  payload,
  checksum,
  eventSecret,
}: {
  payload: WompiWebhookPayload;
  checksum: string;
  eventSecret: string;
}): boolean {
  const signature = payload.signature;
  if (!signature) return false;

  const values = signature.properties.map((property) => {
    const dataValue = getPathValue(payload.data, property);
    if (dataValue !== null) return dataValue;

    return getPathValue(payload, property);
  });

  if (values.some((value) => value === null)) return false;

  // Wompi appends the root-level `timestamp` (unix int) between property values and the secret,
  // regardless of whether "timestamp" is included in signature.properties.
  // See: https://docs.wompi.co/en/docs/colombia/eventos/
  const rootTimestamp = getPathValue(payload, "timestamp");
  const timestampSegment = rootTimestamp ?? "";

  const concatenatedValues = `${values.join("")}${timestampSegment}${eventSecret}`;
  const computedChecksum = createHash("sha256").update(concatenatedValues).digest("hex");

  return constantTimeEqual(computedChecksum, checksum, "hex");
}

export function isWompiApprovedStatus(status: string): boolean {
  return status.toUpperCase() === "APPROVED";
}

export function isWompiFailedStatus(status: string): boolean {
  return ["DECLINED", "ERROR", "VOIDED"].includes(status.toUpperCase());
}
