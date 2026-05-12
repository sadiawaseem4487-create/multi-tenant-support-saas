#!/usr/bin/env node
// Generate fresh values for the secrets that need rotation, and print
// copy/paste blocks for the dashboards (Vercel + n8n).
//
// Does NOT write to .env.local — that's intentional. You want to consciously
// paste these into the right places, in the right order. The script just
// gives you good random values and a checklist.

import { randomBytes } from "node:crypto";

const newWebhookSecret = randomBytes(32).toString("hex");

console.log("");
console.log("=== Sprint 2 secret rotation ===");
console.log("");
console.log("Step 1 / 4  Rotate at the providers");
console.log("------------------------------------");
console.log("a) OpenRouter: https://openrouter.ai/keys");
console.log("   - Delete the old key (the one in the leaked n8n export).");
console.log("   - Create a new key. Copy it.");
console.log("");
console.log("b) Supabase service-role key:");
console.log("   - Supabase dashboard -> Project Settings -> API");
console.log("   - 'service_role' tab -> Reset (or Roll). Copy the new key.");
console.log("   - Note: this also rotates the value used by direct DB clients");
console.log("     in n8n; nothing else in this app uses service_role.");
console.log("");
console.log("c) WEBHOOK_SECRET (generated fresh below).");
console.log("");
console.log("Step 2 / 4  Paste into n8n");
console.log("------------------------------------");
console.log("n8n Cloud -> Settings -> Environments -> set:");
console.log("");
console.log(`  OPENROUTER_API_KEY        = <paste new OpenRouter key>`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY = <paste new Supabase service-role key>`);
console.log(`  WEBHOOK_SECRET            = ${newWebhookSecret}`);
console.log("");
console.log("Step 3 / 4  Paste into Vercel");
console.log("------------------------------------");
console.log("Vercel -> Project -> Settings -> Environment Variables.");
console.log("Update (Production + Preview):");
console.log("");
console.log(`  WEBHOOK_SECRET = ${newWebhookSecret}`);
console.log("");
console.log("Then redeploy (Settings -> Deployments -> Redeploy latest).");
console.log("");
console.log("Step 4 / 4  Update your local .env.local");
console.log("------------------------------------");
console.log("Open ~/company-chat-ui/.env.local and replace:");
console.log("");
console.log(`  WEBHOOK_SECRET=${newWebhookSecret}`);
console.log("");
console.log("------------------------------------");
console.log("After all four steps, verify with:");
console.log("  npm run verify:tenant-isolation");
console.log("  curl -X POST $APP_BASE_URL/api/chat -H 'Content-Type: application/json' \\");
console.log("       -d '{\"message\":\"hello\",\"siteSlug\":\"<demo-site-slug>\"}'");
console.log("");
