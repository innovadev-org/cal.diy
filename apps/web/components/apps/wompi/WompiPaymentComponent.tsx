"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import Link from "next/link";
import { z } from "zod";

const WompiPaymentDataSchema = z.object({
  checkoutUrl: z.string().url(),
});

interface IWompiPaymentComponentProps {
  payment: {
    data: unknown;
  };
}

export const WompiPaymentComponent = (props: IWompiPaymentComponentProps) => {
  const { t } = useLocale();
  const parsedData = WompiPaymentDataSchema.safeParse(props.payment.data);

  if (!parsedData.success) {
    return <p className="mt-3 text-center">{t("couldnt_obtain_payment_url")}</p>;
  }

  return (
    <div className="mt-4 flex h-full w-full flex-col items-center justify-center">
      <Link
        href={parsedData.data.checkoutUrl}
        className="inline-flex items-center justify-center rounded-md bg-emphasis px-12 py-2 font-medium text-base text-inverted shadow-sm hover:bg-emphasis/90 focus:outline-none focus:ring-offset-2">
        {t("pay_with_wompi")}
      </Link>
    </div>
  );
};
