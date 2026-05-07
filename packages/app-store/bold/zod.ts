import { eventTypeAppCardZod } from "@calcom/app-store/eventTypeAppCardZod";
import { RefundPolicy } from "@calcom/lib/payment/types";
import { z } from "zod";
import { boldCredentialKeysSchema } from "./lib/boldCredentialKeysSchema";

export const BoldPaymentOptions = [
  {
    label: "on_booking_option",
    value: "ON_BOOKING",
  },
];

type PaymentOption = (typeof BoldPaymentOptions)[number]["value"];
const VALUES: [PaymentOption, ...PaymentOption[]] = [
  BoldPaymentOptions[0].value,
  ...BoldPaymentOptions.slice(1).map((option) => option.value),
];

export const paymentOptionEnum = z.enum(VALUES);

export const appDataSchema = eventTypeAppCardZod.merge(
  z.object({
    price: z.number(),
    currency: z.string(),
    paymentOption: paymentOptionEnum.optional(),
    enabled: z.boolean().optional(),
    refundPolicy: z.nativeEnum(RefundPolicy).optional(),
    refundDaysCount: z.number().optional(),
    refundCountCalendarDays: z.boolean().optional(),
  })
);

export const appKeysSchema = boldCredentialKeysSchema;
