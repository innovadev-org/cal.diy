"use client";

import { useBookingSuccessRedirect } from "@calcom/features/bookings/lib/bookingSuccessRedirect";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui/components/toast";
import { useEffect, useRef } from "react";
import { z } from "zod";

const BoldPaymentDataSchema = z.object({
  identityKey: z.string().min(1),
  currency: z.string().min(1),
  amount: z.string().min(1),
  orderId: z.string().min(1),
  description: z.string().min(1),
  redirectionUrl: z.string().url(),
  integritySignature: z.string().min(1),
  scriptUrl: z.string().url(),
});

type PaymentPageProps = {
  booking: {
    id: number;
    uid: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    paid: boolean;
    description?: string | null;
    location?: string | null;
    attendees?: Array<{ name: string; email: string; timeZone: string }>;
    user?: { name: string | null; timeZone: string } | null;
    responses?: Record<string, unknown>;
  };
  eventType: {
    successRedirectUrl?: string | null;
    forwardParamsSuccessRedirect?: boolean | null;
  };
};

interface IBoldPaymentComponentProps {
  payment: { data: unknown };
  paymentPageProps: PaymentPageProps;
}

export const BoldPaymentComponent = (props: IBoldPaymentComponentProps) => {
  const { t } = useLocale();
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const parsedData = BoldPaymentDataSchema.safeParse(props.payment.data);

  useEffect(() => {
    if (!parsedData.success || !buttonContainerRef.current) return;

    const checkout = parsedData.data;
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = checkout.scriptUrl;
    script.setAttribute("data-bold-button", "");
    script.setAttribute("data-api-key", checkout.identityKey);
    script.setAttribute("data-currency", checkout.currency);
    script.setAttribute("data-amount", checkout.amount);
    script.setAttribute("data-order-id", checkout.orderId);
    script.setAttribute("data-description", checkout.description);
    script.setAttribute("data-redirection-url", checkout.redirectionUrl);
    script.setAttribute("data-integrity-signature", checkout.integritySignature);

    buttonContainerRef.current.replaceChildren(script);

    return () => {
      script.remove();
    };
  }, [parsedData]);

  if (!parsedData.success) {
    return <p className="mt-3 text-center">{t("couldnt_obtain_payment_url")}</p>;
  }

  return (
    <div className="mt-4 flex h-full w-full flex-col items-center justify-center">
      <PaymentChecker {...props.paymentPageProps} />
      <div ref={buttonContainerRef} />
    </div>
  );
};

function PaymentChecker(props: PaymentPageProps) {
  const searchParams = useCompatSearchParams();
  const bookingSuccessRedirect = useBookingSuccessRedirect();
  const utils = trpc.useUtils();
  const { t } = useLocale();

  useEffect(() => {
    if (searchParams === null) return;

    const sp = searchParams;

    const interval = setInterval(() => {
      (async () => {
        // Paid events are created with status ACCEPTED while paid is still false,
        // so gate polling on paid — not status — or the success redirect never fires.
        if (props.booking.paid) return;

        const { booking: bookingResult } = await utils.viewer.bookings.find.fetch({
          bookingUid: props.booking.uid,
        });

        if (bookingResult?.paid) {
          showToast(t("payment_successful"), "success");

          bookingSuccessRedirect({
            successRedirectUrl: props.eventType.successRedirectUrl ?? null,
            query: {
              uid: props.booking.uid,
              email: sp.get("email"),
              location: t("web_conferencing_details_to_follow"),
            },
            booking: {
              ...props.booking,
              startTime: new Date(props.booking.startTime),
              endTime: new Date(props.booking.endTime),
              user: props.booking.user ? { ...props.booking.user, email: null } : { email: null, name: null },
              responses: undefined,
              attendees: undefined,
              location: props.booking.location ?? null,
              description: props.booking.description ?? null,
            },
            forwardParamsSuccessRedirect: props.eventType.forwardParamsSuccessRedirect ?? null,
          });
        }
      })();
    }, 2000);

    return () => clearInterval(interval);
  }, [
    bookingSuccessRedirect,
    props.booking,
    props.eventType.successRedirectUrl,
    props.eventType.forwardParamsSuccessRedirect,
    searchParams,
    t,
    utils.viewer.bookings,
  ]);

  return null;
}
