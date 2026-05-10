"use client";

import { useBookingSuccessRedirect } from "@calcom/features/bookings/lib/bookingSuccessRedirect";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { showToast } from "@calcom/ui/components/toast";
import { useEffect } from "react";
import { z } from "zod";

const WompiPaymentDataSchema = z.object({
  checkoutUrl: z.string().url(),
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

interface IWompiPaymentComponentProps {
  payment: { data: unknown };
  paymentPageProps: PaymentPageProps;
}

export const WompiPaymentComponent = (props: IWompiPaymentComponentProps) => {
  const { t } = useLocale();
  const parsedData = WompiPaymentDataSchema.safeParse(props.payment.data);

  if (!parsedData.success) {
    return <p className="mt-3 text-center">{t("couldnt_obtain_payment_url")}</p>;
  }

  return (
    <div className="mt-4 flex h-full w-full flex-col items-center justify-center">
      <PaymentChecker {...props.paymentPageProps} />
      <Button color="primary" size="lg" href={parsedData.data.checkoutUrl} className="px-12">
        {t("pay_with_wompi")}
      </Button>
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
        if (props.booking.status === "ACCEPTED") return;

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
