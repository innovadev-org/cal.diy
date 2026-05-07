import type { EventTypeAppSettingsComponent } from "@calcom/app-store/types";
import {
  convertFromSmallestToPresentableCurrencyUnit,
  convertToSmallestCurrencyUnit,
  getCurrencySymbol,
} from "@calcom/lib/currencyConversions";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { RefundPolicy } from "@calcom/lib/payment/types";
import { Alert } from "@calcom/ui/components/alert";
import { Select, TextField } from "@calcom/ui/components/form";
import { useEffect, useState } from "react";
import { currencyOptions } from "../lib/currencyOptions";
import { BoldPaymentOptions as paymentOptions } from "../zod";

type Option = { value: string; label: string };

const EventTypeAppSettingsInterface: EventTypeAppSettingsComponent = ({
  eventType,
  getAppData,
  setAppData,
  disabled,
}) => {
  const { t } = useLocale();
  const price = getAppData("price");
  const currency = getAppData("currency") || currencyOptions[0].value;
  const [selectedCurrency, setSelectedCurrency] = useState(
    currencyOptions.find((c) => c.value === currency) || currencyOptions[0]
  );
  const paymentOption = getAppData("paymentOption");
  const paymentOptionSelectValue = paymentOptions.find((option) => paymentOption === option.value);
  const requirePayment = getAppData("enabled");
  const recurringEventDefined = eventType.recurringEvent?.count !== undefined;

  useEffect(() => {
    if (!requirePayment) return;

    if (!getAppData("currency")) {
      setAppData("currency", currencyOptions[0].value);
    }

    if (!getAppData("paymentOption")) {
      setAppData("paymentOption", paymentOptions[0].value);
    }

    if (!getAppData("refundPolicy")) {
      setAppData("refundPolicy", RefundPolicy.NEVER);
    }
  }, [requirePayment, getAppData, setAppData]);

  if (recurringEventDefined) {
    return <Alert className="mt-2" severity="warning" title={t("warning_recurring_event_payment")} />;
  }

  if (!requirePayment) {
    return null;
  }

  return (
    <>
      <div className="mt-4 block items-center justify-start sm:flex sm:space-x-2">
        <TextField
          data-testid="bold-price-input"
          label={t("price")}
          className="h-[38px]"
          addOnLeading={<>{getCurrencySymbol(selectedCurrency.value)}</>}
          addOnSuffix={currency.toUpperCase()}
          addOnClassname="h-[38px]"
          step="0.01"
          min="0.5"
          type="number"
          required
          placeholder={t("price")}
          disabled={disabled}
          onChange={(e) => {
            setAppData("price", convertToSmallestCurrencyUnit(Number(e.target.value), currency));
          }}
          value={price > 0 ? convertFromSmallestToPresentableCurrencyUnit(price, currency) : undefined}
        />
      </div>

      <div className="mt-5 w-60">
        <label className="text-default mb-1 block text-sm font-medium" htmlFor="currency">
          {t("currency")}
        </label>
        <Select
          data-testid="bold-currency-select"
          variant="default"
          options={currencyOptions}
          value={selectedCurrency}
          className="text-black"
          defaultValue={selectedCurrency}
          isDisabled={disabled}
          onChange={(input) => {
            if (!input) return;

            setSelectedCurrency(input);
            setAppData("currency", input.value);
          }}
        />
      </div>

      <div className="mt-4 w-60">
        <label className="text-default mb-1 block text-sm font-medium" htmlFor="paymentOption">
          {t("payment_option")}
        </label>
        <Select<Option>
          data-testid="bold-payment-option-select"
          defaultValue={
            paymentOptionSelectValue
              ? { ...paymentOptionSelectValue, label: t(paymentOptionSelectValue.label) }
              : { ...paymentOptions[0], label: t(paymentOptions[0].label) }
          }
          options={paymentOptions.map((option) => {
            return { ...option, label: t(option.label) || option.label };
          })}
          onChange={(input) => {
            if (!input) return;

            setAppData("paymentOption", input.value);
            setAppData("refundPolicy", RefundPolicy.NEVER);
            setAppData("refundDaysCount", undefined);
            setAppData("refundCountCalendarDays", undefined);
          }}
          className="mb-1 h-[38px] w-full"
          isDisabled={disabled}
        />
      </div>
    </>
  );
};

export default EventTypeAppSettingsInterface;
