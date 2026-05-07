import AppNotInstalledMessage from "@calcom/app-store/_components/AppNotInstalledMessage";
import {
  boldCredentialKeysSchema,
  type boldEnvironmentSchema,
} from "@calcom/app-store/bold/lib/boldCredentialKeysSchema";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Alert } from "@calcom/ui/components/alert";
import { Button } from "@calcom/ui/components/button";
import { Select, TextField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster } from "sonner";
import type { z } from "zod";

type BoldEnvironment = z.infer<typeof boldEnvironmentSchema>;

type EnvironmentOption = {
  value: BoldEnvironment;
  label: string;
};

const emptyKeyState = {
  identityKey: "",
  secretKey: "",
  webhookSecret: "",
};

export default function BoldSetup() {
  const router = useRouter();
  const { t } = useLocale();
  const [keyState, setKeyState] = useState(emptyKeyState);
  const [environment, setEnvironment] = useState<BoldEnvironment>("sandbox");
  const [loading, setLoading] = useState(false);
  const integrations = trpc.viewer.apps.integrations.useQuery({ variant: "payment", appId: "bold" });
  const [boldPaymentAppCredentials] = integrations.data?.items || [];
  const [credentialId] = boldPaymentAppCredentials?.userCredentialIds || [-1];
  const showContent = !!integrations.data && integrations.isSuccess && !!credentialId;
  const environmentOptions: EnvironmentOption[] = [
    { value: "sandbox", label: t("bold_environment_sandbox") },
    { value: "production", label: t("bold_environment_production") },
  ];
  const selectedEnvironment = environmentOptions.find((option) => option.value === environment);

  const saveKeysMutation = trpc.viewer.apps.updateAppCredentials.useMutation({
    onSuccess: () => {
      showToast(t("keys_have_been_saved"), "success");
      router.push("/event-types");
    },
    onError: (error) => {
      showToast(error.message, "error");
      setLoading(false);
    },
  });

  if (integrations.isPending) {
    return <div className="absolute z-50 flex h-screen w-full items-center bg-gray-200" />;
  }

  return (
    <div className="bg-default flex min-h-screen">
      {showContent ? (
        <div className="bg-default border-subtle m-auto w-full max-w-[43em] overflow-auto rounded border p-6 md:p-10">
          <div className="mb-6">
            <img className="h-11" src="/api/app-store/bold/icon.svg" alt={t("bold_payment_logo")} />
            <h1 className="text-default mt-5 text-lg font-semibold">{t("bold")}</h1>
          </div>

          <Alert className="mb-6" severity="info" title={t("bold_setup_description")} />

          <form
            autoComplete="off"
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (loading) return;

              const parsedKey = boldCredentialKeysSchema.safeParse({
                ...keyState,
                environment,
              });

              if (!parsedKey.success) {
                showToast(t("bold_credentials_required"), "error");
                return;
              }

              setLoading(true);
              saveKeysMutation.mutate({
                credentialId,
                key: parsedKey.data,
              });
            }}>
            <TextField
              label={t("bold_identity_key")}
              type="text"
              name="identityKey"
              id="identityKey"
              value={keyState.identityKey}
              autoComplete="off"
              required
              onChange={(event) => setKeyState({ ...keyState, identityKey: event.target.value })}
            />

            <TextField
              label={t("bold_secret_key")}
              type="password"
              name="secretKey"
              id="secretKey"
              value={keyState.secretKey}
              autoComplete="new-password"
              required
              onChange={(event) => setKeyState({ ...keyState, secretKey: event.target.value })}
            />

            <TextField
              label={t("bold_webhook_secret")}
              type="password"
              name="webhookSecret"
              id="webhookSecret"
              value={keyState.webhookSecret}
              autoComplete="new-password"
              required
              onChange={(event) => setKeyState({ ...keyState, webhookSecret: event.target.value })}
            />

            <div className="w-60">
              <label className="text-default mb-1 block text-sm font-medium" htmlFor="bold-environment">
                {t("bold_environment")}
              </label>
              <Select<EnvironmentOption>
                inputId="bold-environment"
                data-testid="bold-environment-select"
                options={environmentOptions}
                value={selectedEnvironment}
                defaultValue={selectedEnvironment}
                onChange={(input) => {
                  if (!input) return;
                  setEnvironment(input.value);
                }}
              />
            </div>

            <div className="flex flex-row justify-end gap-2 pt-2">
              <Button color="primary" type="submit" loading={loading}>
                {t("save")}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <AppNotInstalledMessage appName="bold" />
      )}
      <Toaster position="bottom-right" />
    </div>
  );
}
