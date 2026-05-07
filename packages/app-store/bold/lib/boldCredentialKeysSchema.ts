import { z } from "zod";

export const boldEnvironmentSchema = z.enum(["sandbox", "production"]);

export const boldCredentialKeysSchema = z.object({
  identityKey: z.string().trim().min(1),
  secretKey: z.string().trim().min(1),
  webhookSecret: z.string().trim().min(1),
  environment: boldEnvironmentSchema.default("sandbox"),
});
