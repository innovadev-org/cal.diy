import { WEBAPP_URL } from "@calcom/lib/constants";
import { convertFromSmallestToPresentableCurrencyUnit } from "@calcom/lib/currencyConversions";
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
import { boldCredentialKeysSchema } from "./boldCredentialKeysSchema";
import { BOLD_SUPPORTED_CURRENCY } from "./currencyOptions";
import { createBoldIntegritySignature, formatBoldAmount } from "./signature";

const log = logger.getSubLogger({ prefix: ["payment-service:bold"] });
const BOLD_PAYMENT_BUTTON_SCRIPT_URL = "https://checkout.bold.co/library/boldPaymentButton.js";

type BoldCredentialKeys = z.infer<typeof boldCredentialKeysSchema>;

class BoldPaymentService implements IAbstractPaymentService {
  private credentials: BoldCredentialKeys | null;

  constructor(credentials: { key: Prisma.JsonValue }) {
    const keyParsing = boldCredentialKeysSchema.safeParse(credentials.key);
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
      throw new ErrorWithCode(ErrorCode.CollectCardFailure, "Bold does not support HOLD payments yet");
    }

    if (!this.credentials) {
      throw new ErrorWithCode(ErrorCode.MissingPaymentCredential, "Bold credentials are missing");
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
      const orderId = uid;
      const currency = payment.currency.toUpperCase();

      if (currency !== BOLD_SUPPORTED_CURRENCY) {
        throw new ErrorWithCode(
          ErrorCode.BadRequest,
          `Bold only supports ${BOLD_SUPPORTED_CURRENCY} payments, but the event is priced in ${currency}`
        );
      }

      const presentableAmount = convertFromSmallestToPresentableCurrencyUnit(payment.amount, currency);
      const amount = formatBoldAmount(presentableAmount);
      const redirectionUrl = `${WEBAPP_URL}/payment/${uid}`;
      const integritySignature = createBoldIntegritySignature({
        orderId,
        amount,
        currency,
        secretKey: this.credentials.secretKey,
      });
      const checkoutData = {
        identityKey: this.credentials.identityKey,
        currency,
        amount,
        orderId,
        description: booking.title,
        redirectionUrl,
        integritySignature,
        scriptUrl: BOLD_PAYMENT_BUTTON_SCRIPT_URL,
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
          amount: payment.amount,
          externalId: orderId,
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

      log.error("Bold payment could not be created", bookingId, safeStringify(error));
      throw new ErrorWithCode(ErrorCode.PaymentCreationFailure, "Bold payment could not be created");
    }
  }

  async collectCard(): Promise<Payment> {
    throw new ErrorWithCode(ErrorCode.CollectCardFailure, "Bold does not support HOLD payments yet");
  }

  chargeCard(): Promise<Payment> {
    throw new ErrorWithCode(ErrorCode.ChargeCardFailure, "Bold does not support delayed charges yet");
  }

  update(): Promise<Payment> {
    throw new ErrorWithCode(ErrorCode.InternalServerError, "Bold payment update is not implemented");
  }

  refund(): Promise<Payment | null> {
    throw new ErrorWithCode(ErrorCode.InternalServerError, "Bold payment refund is not implemented");
  }

  getPaymentPaidStatus(): Promise<string> {
    throw new ErrorWithCode(
      ErrorCode.InternalServerError,
      "Bold payment paid status lookup is not implemented"
    );
  }

  getPaymentDetails(): Promise<Payment> {
    throw new ErrorWithCode(ErrorCode.InternalServerError, "Bold payment details lookup is not implemented");
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
  return new BoldPaymentService(credentials);
}
