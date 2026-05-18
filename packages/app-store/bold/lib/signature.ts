import { createHash } from "node:crypto";

// Bold requires the amount as an integer with no decimals for both COP and USD
// (e.g. USD $100 -> "100", COP $30.000 -> "30000"). Sending decimals makes Bold
// reject the checkout. The same string must feed the integrity signature.
export function formatBoldAmount(amount: number): string {
  return Math.round(amount).toString();
}

// Bold's data-description must be 2-100 characters and contain no URLs;
// violating this rejects the whole checkout with a generic-error. Booking
// titles like "<event> entre <org> y <attendee>" routinely exceed 100 chars.
const BOLD_DESCRIPTION_MAX_LENGTH = 100;

export function formatBoldDescription(description: string): string {
  const withoutUrls = description
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (withoutUrls.length <= BOLD_DESCRIPTION_MAX_LENGTH) {
    return withoutUrls;
  }

  return `${withoutUrls.slice(0, BOLD_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`;
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
