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
import { boldCredentialKeysSchema } from "../lib/boldCredentialKeysSchema";
import {
  getBoldReference,
  getBoldSignatureFromHeader,
  getBoldWebhookAttributes,
  isBoldApprovedType,
  isBoldFailedType,
  parseBoldWebhookPayload,
  shouldStoreBoldEventOnly,
  verifyBoldWebhookSignature,
} from "../lib/webhook";

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
    const payload = parseBoldWebhookPayload(rawBody);
    const reference = getBoldReference(payload);

    if (!reference) {
      return res.status(200).json({ received: true });
    }

    const bookingPaymentRepository = new BookingPaymentRepository();
    const paymentWithCredentials =
      await bookingPaymentRepository.findByExternalIdIncludeBookingUserCredentials(reference, appConfig.type);

    if (!paymentWithCredentials) {
      throw new HttpCode({ statusCode: 404, message: "Cal.diy: payment not found" });
    }

    const credentialKey = paymentWithCredentials.booking?.user?.credentials?.[0]?.key;
    const parsedCredentialKey = boldCredentialKeysSchema.safeParse(credentialKey);
    if (!parsedCredentialKey.success) {
      throw new HttpCode({ statusCode: 404, message: "Cal.diy: Bold credentials not found" });
    }

    const signature = getBoldSignatureFromHeader(req.headers["x-bold-signature"]);
    if (!signature) {
      throw new HttpCode({ statusCode: 400, message: "Cal.diy: missing Bold signature" });
    }

    const isValidSignature = verifyBoldWebhookSignature({
      rawBody,
      signature,
      webhookSecret: parsedCredentialKey.data.identityKey,
    });

    if (!isValidSignature) {
      throw new HttpCode({ statusCode: 400, message: "Cal.diy: invalid Bold signature" });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        externalId: reference,
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

    if (isBoldApprovedType(payload.type)) {
      if (payment.success) {
        return res.status(200).json({ message: "Payment already registered" });
      }

      const traceContext = distributedTracing.createTrace("bold_webhook", {
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

    if (isBoldFailedType(payload.type) || shouldStoreBoldEventOnly(payload.type)) {
      const updatedData = {
        ...(isJsonRecord(payment.data) ? payment.data : {}),
        boldWebhook: getBoldWebhookAttributes(payload),
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
