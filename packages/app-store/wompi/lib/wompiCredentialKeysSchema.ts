import { z } from "zod";

export const wompiEnvironmentSchema = z.enum(["sandbox", "production"]);

export const wompiCredentialKeysSchema = z.object({
  publicKey: z.string().trim().min(1),
  privateKey: z.string().trim().min(1),
  integritySecret: z.string().trim().min(1),
  eventSecret: z.string().trim().min(1),
  environment: wompiEnvironmentSchema.default("sandbox"),
});
