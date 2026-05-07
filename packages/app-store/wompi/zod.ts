import { eventTypeAppCardZod } from "@calcom/app-store/eventTypeAppCardZod";
import { RefundPolicy } from "@calcom/lib/payment/types";
import { z } from "zod";
import { wompiCredentialKeysSchema } from "./lib/wompiCredentialKeysSchema";

export const WompiPaymentOptions = [
  {
    label: "on_booking_option",
    value: "ON_BOOKING",
  },
];

type PaymentOption = (typeof WompiPaymentOptions)[number]["value"];
const VALUES: [PaymentOption, ...PaymentOption[]] = [
  WompiPaymentOptions[0].value,
  ...WompiPaymentOptions.slice(1).map((option) => option.value),
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

export const appKeysSchema = wompiCredentialKeysSchema;
