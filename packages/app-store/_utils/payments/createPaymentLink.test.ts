import { WEBSITE_URL } from "@calcom/lib/constants";
import { describe, expect, it } from "vitest";
import { createPaymentLink } from "./createPaymentLink";

describe("createPaymentLink", () => {
  it("builds an absolute payment link by default", () => {
    const result = createPaymentLink({
      paymentUid: "pay_123",
      date: "2026-05-07T10:00:00.000Z",
      name: "Ada Lovelace",
      email: "ada+test@example.com",
    });

    expect(result).toBe(
      `${WEBSITE_URL}/payment/pay_123?date=2026-05-07T10%3A00%3A00.000Z&name=Ada%20Lovelace&email=ada%2Btest%40example.com`
    );
  });

  it("builds a relative payment link when requested", () => {
    const result = createPaymentLink({
      paymentUid: "pay_123",
      date: "2026-05-07T10:00:00.000Z",
      name: "Ada Lovelace",
      email: "ada@example.com",
      absolute: false,
    });

    expect(result).toBe(
      "/payment/pay_123?date=2026-05-07T10%3A00%3A00.000Z&name=Ada%20Lovelace&email=ada%40example.com"
    );
  });

  it("keeps empty query fields for email templates and booking redirects", () => {
    const result = createPaymentLink({
      paymentUid: "pay_123",
      name: null,
    });

    expect(result).toBe(`${WEBSITE_URL}/payment/pay_123?date=&name=&email=`);
  });
});
