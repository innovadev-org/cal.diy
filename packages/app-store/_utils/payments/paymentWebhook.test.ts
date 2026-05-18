import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { constantTimeEqual, parseJsonRawBody, readRawBody } from "./paymentWebhook";

describe("payment webhook helpers", () => {
  describe("readRawBody", () => {
    it("reads string and buffer chunks into one buffer", async () => {
      const body = await readRawBody(Readable.from(['{"ok":', Buffer.from("true}")]));

      expect(body.toString("utf8")).toBe('{"ok":true}');
    });
  });

  describe("constantTimeEqual", () => {
    it("returns true for matching values", () => {
      expect(constantTimeEqual("abc123", "abc123")).toBe(true);
    });

    it("returns false for different values", () => {
      expect(constantTimeEqual("abc123", "abc124")).toBe(false);
    });

    it("returns false when values have different lengths", () => {
      expect(constantTimeEqual("abc123", "abc1234")).toBe(false);
    });
  });

  describe("parseJsonRawBody", () => {
    it("parses a JSON buffer", () => {
      const payload = parseJsonRawBody<{ ok: boolean }>(Buffer.from('{"ok":true}'));

      expect(payload).toEqual({ ok: true });
    });
  });
});
