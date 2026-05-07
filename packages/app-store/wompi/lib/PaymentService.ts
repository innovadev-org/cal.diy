import { WEBAPP_URL } from "@calcom/lib/constants";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import prisma from "@calcom/prisma";
import type { Booking, Payment, PaymentOption, Prisma } from "@calcom/prisma/client";
import type { CalendarEvent } from "@calcom/types/Calendar";
import type { IAbstractPaymentService } from "@calcom/types/PaymentService";
import { v4 as uuidv4 } from "uuid";
import type { z } from "zod";
import appConfig from "../config.json";
import { createWompiIntegritySignature } from "./signature";
import { wompiCredentialKeysSchema } from "./wompiCredentialKeysSchema";

const log = logger.getSubLogger({ prefix: ["payment-service:wompi"] });
const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

type WompiCredentialKeys = z.infer<typeof wompiCredentialKeysSchema>;

function createWompiCheckoutUrl({
  publicKey,
  currency,
  amountInCents,
  reference,
  integritySignature,
  redirectUrl,
}: {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  integritySignature: string;
  redirectUrl: string;
}): string {
  const params = new URLSearchParams({
    "public-key": publicKey,
    currency,
    "amount-in-cents": amountInCents.toString(),
    reference,
    "signature:integrity": integritySignature,
    "redirect-url": redirectUrl,
  });

  return `${WOMPI_CHECKOUT_URL}?${params.toString()}`;
}

class WompiPaymentService implements IAbstractPaymentService {
  private credentials: WompiCredentialKeys | null;

  constructor(credentials: { key: Prisma.JsonValue }) {
    const keyParsing = wompiCredentialKeysSchema.safeParse(credentials.key);
    this.credentials = keyParsing.success ? keyParsing.data : null;
  }

  async create(
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">,
    bookingId: Booking["id"],
    _userId: Booking["userId"],
    _username: string | null,
    _bookerName: string | null,
    paymentOption: PaymentOption
  ): Promise<Payment> {
    if (paymentOption === "HOLD") {
      throw new ErrorWithCode(ErrorCode.CollectCardFailure, "Wompi does not support HOLD payments yet");
    }

    if (!this.credentials) {
      throw new ErrorWithCode(ErrorCode.MissingPaymentCredential, "Wompi credentials are missing");
    }

    try {
      const booking = await prisma.booking.findUnique({
        where: {
          id: bookingId,
        },
        select: {
          uid: true,
          title: true,
        },
      });

      if (!booking) {
        throw new ErrorWithCode(ErrorCode.BookingNotFound, "Booking not found");
      }

      const uid = uuidv4();
      const reference = uid;
      const amountInCents = payment.amount;
      const currency = payment.currency.toUpperCase();
      const redirectUrl = `${WEBAPP_URL}/payment/${uid}`;
      const integritySignature = createWompiIntegritySignature({
        reference,
        amountInCents,
        currency,
        integritySecret: this.credentials.integritySecret,
      });
      const checkoutUrl = createWompiCheckoutUrl({
        publicKey: this.credentials.publicKey,
        currency,
        amountInCents,
        reference,
        integritySignature,
        redirectUrl,
      });
      const checkoutData = {
        publicKey: this.credentials.publicKey,
        currency,
        amountInCents,
        reference,
        integritySignature,
        redirectUrl,
        checkoutUrl,
        environment: this.credentials.environment,
      } satisfies Prisma.InputJsonObject;

      return await prisma.payment.create({
        data: {
          uid,
          app: {
            connect: {
              slug: appConfig.slug,
            },
          },
          booking: {
            connect: {
              id: bookingId,
            },
          },
          amount: amountInCents,
          externalId: reference,
          currency,
          data: checkoutData,
          fee: 0,
          refunded: false,
          success: false,
          paymentOption,
        },
      });
    } catch (error) {
      if (error instanceof ErrorWithCode) {
        throw error;
      }

      log.error("Wompi payment could not be created", bookingId, safeStringify(error));
      throw new ErrorWithCode(ErrorCode.PaymentCreationFailure, "Wompi payment could not be created");
    }
  }

  async collectCard(): Promise<Payment> {
    throw new ErrorWithCode(ErrorCode.CollectCardFailure, "Wompi does not support HOLD payments yet");
  }

  chargeCard(): Promise<Payment> {
    throw new ErrorWithCode(ErrorCode.ChargeCardFailure, "Wompi does not support delayed charges yet");
  }

  update(): Promise<Payment> {
    throw new ErrorWithCode(ErrorCode.InternalServerError, "Wompi payment update is not implemented");
  }

  refund(): Promise<Payment | null> {
    throw new ErrorWithCode(ErrorCode.InternalServerError, "Wompi payment refund is not implemented");
  }

  getPaymentPaidStatus(): Promise<string> {
    throw new ErrorWithCode(
      ErrorCode.InternalServerError,
      "Wompi payment paid status lookup is not implemented"
    );
  }

  getPaymentDetails(): Promise<Payment> {
    throw new ErrorWithCode(ErrorCode.InternalServerError, "Wompi payment details lookup is not implemented");
  }

  afterPayment(
    _event: CalendarEvent,
    _booking: {
      user: { email: string | null; name: string | null; timeZone: string } | null;
      id: number;
      startTime: { toISOString: () => string };
      uid: string;
    },
    _paymentData: Payment
  ): Promise<void> {
    return Promise.resolve();
  }

  deletePayment(_paymentId: Payment["id"]): Promise<boolean> {
    return Promise.resolve(false);
  }

  isSetupAlready(): boolean {
    return !!this.credentials;
  }
}

export function BuildPaymentService(credentials: { key: Prisma.JsonValue }): IAbstractPaymentService {
  return new WompiPaymentService(credentials);
}
