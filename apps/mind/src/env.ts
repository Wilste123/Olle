import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

/** Load `.env` from repo root (cwd when using npm scripts). Idempotent. */
export function loadOlleEnv(): void {
  if (loaded) return;
  const root = process.cwd();
  const envPath = resolve(root, ".env");
  if (existsSync(envPath)) {
    config({ path: envPath });
  } else {
    config();
  }
  loaded = true;
}
