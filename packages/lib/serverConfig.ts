import process from "node:process";
import { isENVDev } from "@calcom/lib/env";
import type SendmailTransport from "nodemailer/lib/sendmail-transport";
import type SMTPConnection from "nodemailer/lib/smtp-connection";
import type SMTPPool from "nodemailer/lib/smtp-pool";
import { getAdditionalEmailHeaders } from "./getAdditionalEmailHeaders";

function detectTransport(): SendmailTransport.Options | SMTPConnection.Options | SMTPPool.Options | string {
  if (process.env.RESEND_API_KEY) {
    const transport = {
      host: "smtp.resend.com",
      secure: true,
      port: 465,
      auth: {
        user: "resend",
        pass: process.env.RESEND_API_KEY,
      },
    };

    return transport;
  }

  if (process.env.EMAIL_SERVER) {
    return process.env.EMAIL_SERVER;
  }

  if (process.env.EMAIL_SERVER_HOST) {
    const port = parseInt(process.env.EMAIL_SERVER_PORT || "");
    const auth =
      process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
        ? {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          }
        : undefined;

    // Pool + rate-limit + requireTLS keeps providers like Gmail SMTP relay
    // (smtp-relay.gmail.com) from rejecting bursts of parallel connections
    // with `421 4.7.0 Try again later, closing connection. (EHLO)`.
    const transport: SMTPPool.Options = {
      host: process.env.EMAIL_SERVER_HOST,
      port,
      auth,
      secure: port === 465,
      requireTLS: port !== 465,
      pool: true,
      maxConnections: 1,
      maxMessages: 50,
      rateDelta: 1000,
      rateLimit: 3,
      tls: {
        rejectUnauthorized: !isENVDev,
      },
    };

    return transport;
  }

  return {
    sendmail: true,
    newline: "unix",
    path: "/usr/sbin/sendmail",
  };
}

export const serverConfig = {
  transport: detectTransport(),
  from: process.env.EMAIL_FROM,
  headers: getAdditionalEmailHeaders()[process.env.EMAIL_SERVER_HOST || ""] || undefined,
};
