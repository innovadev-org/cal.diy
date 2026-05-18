import { WEBSITE_URL } from "@calcom/lib/constants";

export type Maybe<T> = T | null | undefined;

export type CreatePaymentLinkOptions = {
  paymentUid: string;
  name?: Maybe<string>;
  date?: Maybe<string>;
  email?: Maybe<string>;
  absolute?: boolean;
};

function stringifyPaymentLinkQuery({
  date,
  name,
  email,
}: Pick<CreatePaymentLinkOptions, "date" | "name" | "email">): string {
  const queryEntries: Array<[string, Maybe<string>]> = [
    ["date", date],
    ["name", name],
    ["email", email],
  ];

  return queryEntries.map(([key, value]) => `${key}=${encodeURIComponent(value ?? "")}`).join("&");
}

export function createPaymentLink(opts: CreatePaymentLinkOptions): string {
  const { paymentUid, absolute = true } = opts;
  const link = absolute ? WEBSITE_URL : "";
  const query = stringifyPaymentLinkQuery(opts);

  return `${link}/payment/${paymentUid}?${query}`;
}
