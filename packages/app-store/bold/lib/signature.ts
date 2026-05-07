import { createHash } from "node:crypto";

export function formatBoldAmount(amount: number): string {
  return amount.toFixed(2).replace(/\.?0+$/, "");
}

export function createBoldIntegritySignature({
  orderId,
  amount,
  currency,
  secretKey,
}: {
  orderId: string;
  amount: string;
  currency: string;
  secretKey: string;
}): string {
  return createHash("sha256").update(`${orderId}${amount}${currency}${secretKey}`).digest("hex");
}
