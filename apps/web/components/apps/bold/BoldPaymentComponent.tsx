"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
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

interface IBoldPaymentComponentProps {
  payment: {
    data: unknown;
  };
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
      <div ref={buttonContainerRef} />
    </div>
  );
};
