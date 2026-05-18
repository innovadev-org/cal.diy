import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBoldIntegritySignature, formatBoldAmount } from "./signature";

describe("createBoldIntegritySignature", () => {
  it("hashes order id, amount, currency, and secret key in Bold order", () => {
    const orderId = "booking-payment-123";
    const amount = "25000";
    const currency = "COP";
    const secretKey = "test_secret_key";

    const expected = createHash("sha256").update(`${orderId}${amount}${currency}${secretKey}`).digest("hex");

    expect(
      createBoldIntegritySignature({
        orderId,
        amount,
        currency,
        secretKey,
      })
    ).toBe(expected);
  });
});

describe("formatBoldAmount", () => {
  it("formats amounts as integers with no decimals (Bold requirement)", () => {
    expect(formatBoldAmount(25000)).toBe("25000");
    expect(formatBoldAmount(100)).toBe("100");
  });

  it("rounds fractional amounts to the nearest integer", () => {
    expect(formatBoldAmount(25000.5)).toBe("25001");
    expect(formatBoldAmount(99.49)).toBe("99");
    expect(formatBoldAmount(99.5)).toBe("100");
  });
});
