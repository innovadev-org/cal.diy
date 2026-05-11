import { handlePaymentSuccess } from "@calcom/app-store/_utils/payments/handlePaymentSuccess";
import { readRawBody } from "@calcom/app-store/_utils/payments/paymentWebhook";
import { PrismaBookingPaymentRepository as BookingPaymentRepository } from "@calcom/features/bookings/repositories/PrismaBookingPaymentRepository";
import { IS_PRODUCTION } from "@calcom/lib/constants";
import { HttpError as HttpCode } from "@calcom/lib/http-error";
import { getServerErrorFromUnknown } from "@calcom/lib/server/getServerErrorFromUnknown";
import { distributedTracing } from "@calcom/lib/tracing/factory";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import appConfig from "../config.json";
import {
  getWompiEventChecksumFromHeader,
  getWompiTransaction,
  isWompiApprovedStatus,
  isWompiFailedStatus,
  parseWompiWebhookPayload,
  verifyWompiEventChecksum,
} from "../lib/webhook";
import { wompiCredentialKeysSchema } from "../lib/wompiCredentialKeysSchema";

export const config = { api: { bodyParser: false } };

type JsonRecord = Record<string, Prisma.JsonValue>;

function isJsonRecord(value: Prisma.JsonValue): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      throw new HttpCode({ statusCode: 405, message: "Method Not Allowed" });
    }

    const rawBody = await readRawBody(req);
    const payload = parseWompiWebhookPayload(rawBody);
    const transaction = getWompiTransaction(payload);

    const bookingPaymentRepository = new BookingPaymentRepository();
    const paymentWithCredentials =
      await bookingPaymentRepository.findByExternalIdIncludeBookingUserCredentials(
        transaction.reference,
        appConfig.type
      );

    if (!paymentWithCredentials) {
      throw new HttpCode({ statusCode: 404, message: "Cal.diy: payment not found" });
    }

    const userCredentials = paymentWithCredentials.booking?.user?.credentials ?? [];
    const parsedCredentialKey = userCredentials.reduce<ReturnType<typeof wompiCredentialKeysSchema.safeParse> | null>(
      (acc, credential) => {
        if (acc?.success) return acc;
        return wompiCredentialKeysSchema.safeParse(credential.key);
      },
      null
    );
    if (!parsedCredentialKey?.success) {
      throw new HttpCode({ statusCode: 404, message: "Cal.diy: Wompi credentials not found" });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        externalId: transaction.reference,
        appId: appConfig.slug,
      },
      select: {
        id: true,
        bookingId: true,
        success: true,
        data: true,
      },
    });

    if (!payment) {
      throw new HttpCode({ statusCode: 404, message: "Cal.diy: payment not found" });
    }

    const checksum =
      getWompiEventChecksumFromHeader(req.headers["x-event-checksum"]) ?? payload.signature?.checksum;
    if (!checksum) {
      throw new HttpCode({ statusCode: 400, message: "Cal.diy: missing Wompi checksum" });
    }

    const isValidChecksum = verifyWompiEventChecksum({
      payload,
      checksum,
      eventSecret: parsedCredentialKey.data.eventSecret,
    });

    if (!isValidChecksum) {
      throw new HttpCode({ statusCode: 400, message: "Cal.diy: invalid Wompi checksum" });
    }

    if (isWompiApprovedStatus(transaction.status)) {
      if (payment.success) {
        return res.status(200).json({ message: "Payment already registered" });
      }

      const traceContext = distributedTracing.createTrace("wompi_webhook", {
        meta: { paymentId: payment.id, bookingId: payment.bookingId },
      });

      await handlePaymentSuccess({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        appSlug: appConfig.slug,
        traceContext,
      });

      return res.status(200).json({ success: true });
    }

    if (isWompiFailedStatus(transaction.status)) {
      const updatedData = {
        ...(isJsonRecord(payment.data) ? payment.data : {}),
        wompiWebhook: {
          status: transaction.status,
          transactionId: transaction.id,
          event: payload.event ?? null,
        },
      } satisfies Prisma.InputJsonObject;

      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          data: updatedData,
        },
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    const err = getServerErrorFromUnknown(error);
    return res.status(err.statusCode).send({
      message: err.message,
      stack: IS_PRODUCTION ? undefined : err.cause?.stack,
    });
  }
}
