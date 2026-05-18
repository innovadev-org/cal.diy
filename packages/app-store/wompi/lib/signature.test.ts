import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWompiIntegritySignature } from "./signature";

describe("createWompiIntegritySignature", () => {
  it("hashes reference, amount, currency, and integrity secret in Wompi order", () => {
    const reference = "booking-payment-123";
    const amountInCents = 2500000;
    const currency = "COP";
    const integritySecret = "test_integrity_secret";

    const expected = createHash("sha256")
      .update(`${reference}${amountInCents}${currency}${integritySecret}`)
      .digest("hex");

    expect(
      createWompiIntegritySignature({
        reference,
        amountInCents,
        currency,
        integritySecret,
      })
    ).toBe(expected);
  });
});
