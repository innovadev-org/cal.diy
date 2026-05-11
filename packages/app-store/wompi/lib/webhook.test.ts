import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getWompiEventChecksumFromHeader,
  getWompiTransaction,
  isWompiApprovedStatus,
  isWompiFailedStatus,
  parseWompiWebhookPayload,
  verifyWompiEventChecksum,
} from "./webhook";

describe("Wompi webhook helpers", () => {
  const eventSecret = "test_event_secret";
  const timestamp = 1530291411;
  const payload = {
    event: "transaction.updated",
    data: {
      transaction: {
        id: "txn_123",
        reference: "payment_ref_123",
        status: "APPROVED",
        amount_in_cents: 2500000,
        currency: "COP",
      },
    },
    signature: {
      properties: [
        "transaction.id",
        "transaction.status",
        "transaction.amount_in_cents",
        "transaction.currency",
      ],
      checksum: "0".repeat(64),
    },
    timestamp,
  };

  it("parses Wompi transaction payloads", () => {
    const parsedPayload = parseWompiWebhookPayload(Buffer.from(JSON.stringify(payload)));

    expect(getWompiTransaction(parsedPayload)).toEqual(payload.data.transaction);
  });

  it("validates checksum appending the root timestamp between property values and the secret", () => {
    const checksum = createHash("sha256")
      .update(`txn_123APPROVED2500000COP${timestamp}test_event_secret`)
      .digest("hex");
    const parsedPayload = parseWompiWebhookPayload(
      Buffer.from(JSON.stringify({ ...payload, signature: { ...payload.signature, checksum } }))
    );

    expect(verifyWompiEventChecksum({ payload: parsedPayload, checksum, eventSecret })).toBe(true);
  });

  it("rejects checksum when computed without the root timestamp", () => {
    const wrongChecksum = createHash("sha256")
      .update("txn_123APPROVED2500000COPtest_event_secret")
      .digest("hex");
    const parsedPayload = parseWompiWebhookPayload(Buffer.from(JSON.stringify(payload)));

    expect(verifyWompiEventChecksum({ payload: parsedPayload, checksum: wrongChecksum, eventSecret })).toBe(
      false
    );
  });

  it("rejects invalid checksums", () => {
    const parsedPayload = parseWompiWebhookPayload(Buffer.from(JSON.stringify(payload)));

    expect(
      verifyWompiEventChecksum({
        payload: parsedPayload,
        checksum: "0".repeat(64),
        eventSecret,
      })
    ).toBe(false);
  });

  it("reads checksum headers", () => {
    expect(getWompiEventChecksumFromHeader("abc")).toBe("abc");
    expect(getWompiEventChecksumFromHeader(["abc", "def"])).toBe("abc");
    expect(getWompiEventChecksumFromHeader(undefined)).toBeNull();
  });

  it("maps terminal statuses", () => {
    expect(isWompiApprovedStatus("APPROVED")).toBe(true);
    expect(isWompiFailedStatus("DECLINED")).toBe(true);
    expect(isWompiFailedStatus("ERROR")).toBe(true);
    expect(isWompiFailedStatus("VOIDED")).toBe(true);
    expect(isWompiFailedStatus("PENDING")).toBe(false);
  });
});
