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

    const isHandledEvent =
      isBoldApprovedType(payload.type) ||
      isBoldFailedType(payload.type) ||
      shouldStoreBoldEventOnly(payload.type);

    // Acknowledge events we intentionally do not act on so Bold stops retrying them.
    if (!isHandledEvent) {
      return res.status(200).json({ received: true });
    }

    const reference = getBoldReference(payload);

    // A handled event (e.g. SALE_APPROVED) without a reference cannot be reconciled
    // to a payment. Returning a non-2xx makes Bold retry instead of silently dropping
    // a successful payment, which would leave the booking unpaid forever.
    if (!reference) {
      throw new HttpCode({ statusCode: 422, message: "Cal.diy: Bold webhook missing reference" });
    }

    const bookingPaymentRepository = new BookingPaymentRepository();
    const paymentWithCredentials =
      await bookingPaymentRepository.findByExternalIdIncludeBookingUserCredentials(reference, appConfig.type);

    if (!paymentWithCredentials) {
      throw new HttpCode({ statusCode: 404, message: "Cal.diy: payment not found" });
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

    const checkoutData = isJsonRecord(payment.data) ? payment.data : {};
    const checkoutIdentityKey =
      typeof checkoutData.identityKey === "string" ? checkoutData.identityKey : null;

    const userCredentials = paymentWithCredentials.booking?.user?.credentials ?? [];
    const teamCredentials = paymentWithCredentials.booking?.eventType?.team?.credentials ?? [];
    const parsedCredentials = [...userCredentials, ...teamCredentials].flatMap((credential) => {
      const result = boldCredentialKeysSchema.safeParse(credential.key);
      return result.success ? [result.data] : [];
    });

    // Pick the credential that actually created this checkout (its identity key is
    // persisted in Payment.data) so a team-owned credential is not shadowed by the
    // organizer's personal one when both exist.
    const credentialKey =
      parsedCredentials.find((data) => data.identityKey === checkoutIdentityKey) ?? parsedCredentials[0];
    if (!credentialKey) {
      throw new HttpCode({ statusCode: 404, message: "Cal.diy: Bold credentials not found" });
    }

    const signature = getBoldSignatureFromHeader(req.headers["x-bold-signature"]);
    if (!signature) {
      throw new HttpCode({ statusCode: 400, message: "Cal.diy: missing Bold signature" });
    }

    // Bold signs webhooks with the merchant secret key (never the browser-exposed
    // identity key). For test/sandbox credentials Bold signs with an empty secret.
    const webhookSecret = credentialKey.environment === "production" ? credentialKey.secretKey : "";

    const isValidSignature = verifyBoldWebhookSignature({
      rawBody,
      signature,
      webhookSecret,
    });

    if (!isValidSignature) {
      throw new HttpCode({ statusCode: 400, message: "Cal.diy: invalid Bold signature" });
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
