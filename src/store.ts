import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";

export type TokenSet = {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
  email?: string | null;
};

type StoreShape = {
  tokens: TokenSet | null;
};

function ensureDir() {
  mkdirSync(config.dataDir, { recursive: true });
}

function path() {
  return join(config.dataDir, "store.json");
}

function read(): StoreShape {
  ensureDir();
  if (!existsSync(path())) {
    return { tokens: null };
  }
  return JSON.parse(readFileSync(path(), "utf8")) as StoreShape;
}

function write(data: StoreShape) {
  ensureDir();
  writeFileSync(path(), JSON.stringify(data, null, 2));
}

export const store = {
  getTokens(): TokenSet | null {
    return read().tokens;
  },
  setTokens(tokens: TokenSet | null) {
    const data = read();
    data.tokens = tokens;
    write(data);
  },
  clearTokens() {
    this.setTokens(null);
  },
  isConnected(): boolean {
    const t = this.getTokens();
    return Boolean(t?.access_token || t?.refresh_token);
  },
};
