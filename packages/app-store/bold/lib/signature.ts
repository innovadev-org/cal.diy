import { createHash } from "node:crypto";

// Bold requires the amount as an integer with no decimals for both COP and USD
// (e.g. USD $100 -> "100", COP $30.000 -> "30000"). Sending decimals makes Bold
// reject the checkout. The same string must feed the integrity signature.
export function formatBoldAmount(amount: number): string {
  return Math.round(amount).toString();
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
