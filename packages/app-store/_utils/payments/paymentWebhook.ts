import { timingSafeEqual } from "node:crypto";

type RawBodyChunk = Buffer | Uint8Array | string;

export async function readRawBody(stream: AsyncIterable<RawBodyChunk>): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export function constantTimeEqual(left: string, right: string, encoding: BufferEncoding = "utf8"): boolean {
  const leftBuffer = Buffer.from(left, encoding);
  const rightBuffer = Buffer.from(right, encoding);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function parseJsonRawBody<T = unknown>(rawBody: Buffer): T {
  return JSON.parse(rawBody.toString("utf8")) as T;
}
