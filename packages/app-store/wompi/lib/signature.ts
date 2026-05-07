import { createHash } from "node:crypto";

export function createWompiIntegritySignature({
  reference,
  amountInCents,
  currency,
  integritySecret,
}: {
  reference: string;
  amountInCents: number;
  currency: string;
  integritySecret: string;
}): string {
  return createHash("sha256")
    .update(`${reference}${amountInCents}${currency}${integritySecret}`)
    .digest("hex");
}
