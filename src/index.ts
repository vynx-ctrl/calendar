import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config, googleConfigured } from "./config.js";
import { apiRouter } from "./api.js";
import { messagingRouter } from "./messaging.js";
import { exchangeCode, getAuthUrl } from "./google-auth.js";
import { handleMcpGet, handleMcpPost } from "./mcp.js";
import { store } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/auth/google", (_req, res) => {
  try {
    if (!googleConfigured()) {
      return res
        .status(500)
        .send(
          "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set. Copy .env.example to .env and fill them in.",
        );
    }
    res.redirect(getAuthUrl());
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : String(err));
  }
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (typeof code !== "string") {
      return res.status(400).send("Missing code");
    }
    await exchangeCode(code);
    res.redirect("/?connected=1");
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : String(err));
  }
});

app.post("/auth/logout", (_req, res) => {
  store.clearTokens();
  res.json({ ok: true });
});

app.use("/api", apiRouter);
app.use("/hooks", messagingRouter);

app.post("/mcp", (req, res) => {
  void handleMcpPost(req, res);
});
app.get("/mcp", (req, res) => {
  void handleMcpGet(req, res);
});

app.use(express.static(publicDir));

app.use((_req, res) => {
  res.sendFile(join(publicDir, "index.html"));
});

app.listen(config.port, () => {
  console.log(`Self-hosted calendar listening on ${config.baseUrl}`);
  console.log(`  UI:        ${config.baseUrl}/`);
  console.log(`  API:       ${config.baseUrl}/api/events`);
  console.log(`  MCP:       ${config.baseUrl}/mcp`);
  console.log(`  Messaging: ${config.baseUrl}/hooks/message`);
  console.log(`  Slack:     ${config.baseUrl}/hooks/slack`);
  console.log(
    `  Google:    ${googleConfigured() ? "configured" : "NOT configured — set GOOGLE_CLIENT_ID/SECRET"}`,
  );
});
