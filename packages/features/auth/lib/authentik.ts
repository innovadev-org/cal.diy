import type { User } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";

type AuthentikProfile = {
  sub: string;
  name?: string;
  preferred_username?: string;
  email: string;
  email_verified?: boolean;
  picture?: string;
};

export const AUTHENTIK_PROVIDER_ID = "saml-idp";

export const getAuthentikProvider = ({
  clientId,
  clientSecret,
  issuer,
}: {
  clientId: string;
  clientSecret: string;
  issuer: string;
}): OAuthConfig<AuthentikProfile> => {
  const normalizedIssuer = `${issuer.replace(/\/+$/, "")}/`;

  return {
    id: AUTHENTIK_PROVIDER_ID,
    name: "InnovaDev SSO",
    type: "oauth",
    clientId,
    clientSecret,
    issuer: normalizedIssuer,
    wellKnown: `${normalizedIssuer}.well-known/openid-configuration`,
    authorization: { params: { scope: "openid email profile" } },
    idToken: true,
    checks: ["pkce", "state"],
    allowDangerousEmailAccountLinking: true,
    profile(profile: AuthentikProfile): User {
      // Cal.com narrows NextAuth's User.id to its numeric database id, but OAuth provider
      // account IDs are strings. Keep Authentik's stable `sub` at runtime; NextAuth uses it
      // as providerAccountId before a Cal.com user has a database id.
      const providerAccountId = profile.sub as unknown as number;

      return {
        id: providerAccountId,
        name: profile.name ?? profile.preferred_username ?? profile.email,
        email: profile.email,
        image: profile.picture ?? null,
        email_verified: profile.email_verified === true,
      };
    },
  };
};
