// Bold settles in COP but also supports USD on the payment button: the buyer sees
// USD and Bold processes the sale in COP at the current TRM (USD is card-only and
// must be enabled on the merchant's Bold account). Any other currency produces an
// opaque BTN-001 "generic-error" at checkout.bold.co with no payment-btn created.
export const BOLD_SUPPORTED_CURRENCIES = ["COP", "USD"] as const;

export type BoldSupportedCurrency = (typeof BOLD_SUPPORTED_CURRENCIES)[number];

export const currencyOptions = [
  { label: "COP", value: "COP" },
  { label: "USD", value: "USD" },
];
