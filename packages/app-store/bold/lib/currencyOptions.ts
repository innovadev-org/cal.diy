// Bold is a Colombian acquirer and only settles COP. Offering any other currency
// produces an opaque BTN-001 "generic-error" at checkout.bold.co with no payment-btn created.
export const BOLD_SUPPORTED_CURRENCY = "COP";

export const currencyOptions = [{ label: "COP", value: "COP" }];
