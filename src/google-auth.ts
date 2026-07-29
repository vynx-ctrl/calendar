import { google } from "googleapis";
import { config, googleConfigured } from "./config.js";
import { store, type TokenSet } from "./store.js";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createOAuthClient() {
  if (!googleConfigured()) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    `${config.baseUrl}/auth/google/callback`,
  );
}

export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCode(code: string): Promise<TokenSet> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? null;
  } catch {
    // email is optional
  }

  const saved: TokenSet = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? store.getTokens()?.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
    email,
  };
  store.setTokens(saved);
  return saved;
}

export async function getAuthedClient() {
  const tokens = store.getTokens();
  if (!tokens?.refresh_token && !tokens?.access_token) {
    throw new Error("Not connected to Google. Visit /auth/google first.");
  }
  const client = createOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });
  client.on("tokens", (fresh) => {
    const current = store.getTokens() ?? {};
    store.setTokens({
      ...current,
      access_token: fresh.access_token ?? current.access_token,
      refresh_token: fresh.refresh_token ?? current.refresh_token,
      expiry_date: fresh.expiry_date ?? current.expiry_date,
      scope: fresh.scope ?? current.scope,
      token_type: fresh.token_type ?? current.token_type,
    });
  });
  return client;
}
