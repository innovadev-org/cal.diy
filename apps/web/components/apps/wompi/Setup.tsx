import AppNotInstalledMessage from "@calcom/app-store/_components/AppNotInstalledMessage";
import {
  wompiCredentialKeysSchema,
  type wompiEnvironmentSchema,
} from "@calcom/app-store/wompi/lib/wompiCredentialKeysSchema";
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

type WompiEnvironment = z.infer<typeof wompiEnvironmentSchema>;

type EnvironmentOption = {
  value: WompiEnvironment;
  label: string;
};

const emptyKeyState = {
  publicKey: "",
  privateKey: "",
  integritySecret: "",
  eventSecret: "",
};

export default function WompiSetup() {
  const router = useRouter();
  const { t } = useLocale();
  const [keyState, setKeyState] = useState(emptyKeyState);
  const [environment, setEnvironment] = useState<WompiEnvironment>("sandbox");
  const [loading, setLoading] = useState(false);
  const integrations = trpc.viewer.apps.integrations.useQuery({ variant: "payment", appId: "wompi" });
  const [wompiPaymentAppCredentials] = integrations.data?.items || [];
  const [credentialId] = wompiPaymentAppCredentials?.userCredentialIds || [-1];
  const showContent = !!integrations.data && integrations.isSuccess && !!credentialId;
  const environmentOptions: EnvironmentOption[] = [
    { value: "sandbox", label: t("wompi_environment_sandbox") },
    { value: "production", label: t("wompi_environment_production") },
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
            <img className="h-11" src="/api/app-store/wompi/icon.svg" alt={t("wompi_payment_logo")} />
            <h1 className="text-default mt-5 text-lg font-semibold">{t("wompi")}</h1>
          </div>

          <Alert className="mb-6" severity="info" title={t("wompi_setup_description")} />

          <form
            autoComplete="off"
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (loading) return;

              const parsedKey = wompiCredentialKeysSchema.safeParse({
                ...keyState,
                environment,
              });

              if (!parsedKey.success) {
                showToast(t("wompi_credentials_required"), "error");
                return;
              }

              setLoading(true);
              saveKeysMutation.mutate({
                credentialId,
                key: parsedKey.data,
              });
            }}>
            <TextField
              label={t("wompi_public_key")}
              type="text"
              name="publicKey"
              id="publicKey"
              value={keyState.publicKey}
              autoComplete="off"
              required
              onChange={(event) => setKeyState({ ...keyState, publicKey: event.target.value })}
            />

            <TextField
              label={t("wompi_private_key")}
              type="password"
              name="privateKey"
              id="privateKey"
              value={keyState.privateKey}
              autoComplete="new-password"
              required
              onChange={(event) => setKeyState({ ...keyState, privateKey: event.target.value })}
            />

            <TextField
              label={t("wompi_integrity_secret")}
              type="password"
              name="integritySecret"
              id="integritySecret"
              value={keyState.integritySecret}
              autoComplete="new-password"
              required
              onChange={(event) => setKeyState({ ...keyState, integritySecret: event.target.value })}
            />

            <TextField
              label={t("wompi_event_secret")}
              type="password"
              name="eventSecret"
              id="eventSecret"
              value={keyState.eventSecret}
              autoComplete="new-password"
              required
              onChange={(event) => setKeyState({ ...keyState, eventSecret: event.target.value })}
            />

            <div className="w-60">
              <label className="text-default mb-1 block text-sm font-medium" htmlFor="wompi-environment">
                {t("wompi_environment")}
              </label>
              <Select<EnvironmentOption>
                inputId="wompi-environment"
                data-testid="wompi-environment-select"
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
        <AppNotInstalledMessage appName="wompi" />
      )}
      <Toaster position="bottom-right" />
    </div>
  );
}
