import { describe, expect, it } from "vitest";
import { AUTHENTIK_PROVIDER_ID, getAuthentikProvider } from "./authentik";

describe("getAuthentikProvider", () => {
  const provider = getAuthentikProvider({
    clientId: "cal-client",
    clientSecret: "secret",
    issuer: "https://auth.example.com/application/o/cal/",
  });

  it("uses the existing SAML identity alias and strict OIDC discovery", () => {
    expect(provider.id).toBe(AUTHENTIK_PROVIDER_ID);
    expect(provider.issuer).toBe("https://auth.example.com/application/o/cal/");
    expect(provider.wellKnown).toBe(
      "https://auth.example.com/application/o/cal/.well-known/openid-configuration"
    );
    expect(provider.checks).toEqual(["pkce", "state"]);
  });

  it("preserves Authentik's verified-email claim", () => {
    expect(
      provider.profile?.({
        sub: "authentik-user-id",
        name: "Mafe",
        email: "mafe@example.com",
        email_verified: true,
      })
    ).toMatchObject({
      id: "authentik-user-id",
      name: "Mafe",
      email: "mafe@example.com",
      email_verified: true,
    });
  });
});
