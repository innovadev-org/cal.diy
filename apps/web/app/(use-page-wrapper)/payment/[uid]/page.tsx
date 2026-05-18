import { APP_NAME } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";
import { buildLegacyCtx } from "@lib/buildLegacyCtx";
import type { PageProps } from "app/_types";
import { _generateMetadata } from "app/_utils";
import { withAppDirSsr } from "app/WithAppDirSsr";
import type { GetServerSidePropsContext } from "next";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import type { PaymentPageProps } from "./PaymentPage";
import PaymentPage from "./PaymentPage";

const paramsSchema = z.object({
  uid: z.string().min(1),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toRecordOrEmpty = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  return value;
};

const toRecordOrNull = (value: unknown): Record<string, unknown> | null => {
  if (value === null) return null;
  if (!isRecord(value)) return null;
  return value;
};

export const generateMetadata = async ({ params, searchParams }: PageProps) => {
  const props = await getData(
    buildLegacyCtx(await headers(), await cookies(), await params, await searchParams)
  );
  const eventName = props.booking.title;
  return await _generateMetadata(
    (t) => `${t("payment")} | ${eventName} | ${APP_NAME}`,
    () => "",
    undefined,
    undefined,
    `/payment/${(await params).uid}`
  );
};

const getData = withAppDirSsr<PaymentPageProps>(async (context: GetServerSidePropsContext) => {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) {
    return { notFound: true };
  }

  const payment = await prisma.payment.findUnique({
    where: {
      uid: params.data.uid,
    },
    select: {
      id: true,
      uid: true,
      success: true,
      refunded: true,
      amount: true,
      currency: true,
      paymentOption: true,
      data: true,
      appId: true,
      booking: {
        select: {
          id: true,
          uid: true,
          title: true,
          description: true,
          startTime: true,
          endTime: true,
          status: true,
          paid: true,
          location: true,
          responses: true,
          attendees: {
            select: {
              name: true,
              email: true,
              timeZone: true,
            },
          },
          user: {
            select: {
              name: true,
              username: true,
              timeZone: true,
              hideBranding: true,
              theme: true,
            },
          },
          eventType: {
            select: {
              id: true,
              title: true,
              length: true,
              price: true,
              currency: true,
              metadata: true,
              successRedirectUrl: true,
              forwardParamsSuccessRedirect: true,
              recurringEvent: true,
              owner: {
                select: {
                  name: true,
                  username: true,
                  timeZone: true,
                  hideBranding: true,
                  theme: true,
                },
              },
              team: {
                select: {
                  hideBranding: true,
                  theme: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return { notFound: true };
  }

  const booking = payment.booking;
  if (!booking?.eventType) {
    return { notFound: true };
  }

  const eventType = booking.eventType;
  const profile = {
    theme: eventType.team?.theme ?? eventType.owner?.theme ?? booking.user?.theme ?? null,
    hideBranding:
      eventType.team?.hideBranding ?? eventType.owner?.hideBranding ?? booking.user?.hideBranding ?? false,
  };
  const user = eventType.owner ?? booking.user;

  return {
    props: {
      payment: {
        id: payment.id,
        uid: payment.uid,
        success: payment.success,
        refunded: payment.refunded,
        amount: payment.amount,
        currency: payment.currency,
        paymentOption: payment.paymentOption,
        data: toRecordOrEmpty(payment.data),
        appId: payment.appId,
      },
      booking: {
        id: booking.id,
        uid: booking.uid,
        title: booking.title,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
        paid: booking.paid,
        description: booking.description,
        location: booking.location,
        attendees: booking.attendees,
        user: booking.user
          ? {
              name: booking.user.name,
              timeZone: booking.user.timeZone,
            }
          : null,
        responses: toRecordOrEmpty(booking.responses),
      },
      eventType: {
        id: eventType.id,
        title: eventType.title,
        length: eventType.length,
        price: eventType.price,
        currency: eventType.currency,
        metadata: toRecordOrNull(eventType.metadata),
        successRedirectUrl: eventType.successRedirectUrl,
        forwardParamsSuccessRedirect: eventType.forwardParamsSuccessRedirect,
        recurringEvent: eventType.recurringEvent,
      },
      profile,
      user: user
        ? {
            name: user.name,
            username: user.username,
          }
        : null,
    },
  };
});

const ServerPage = async ({ params, searchParams }: PageProps) => {
  const props = await getData(
    buildLegacyCtx(await headers(), await cookies(), await params, await searchParams)
  );

  return <PaymentPage {...props} />;
};
export default ServerPage;
