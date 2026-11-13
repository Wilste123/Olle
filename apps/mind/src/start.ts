/**
 * Olle daily-use entrypoint: mind tick loop + inbound email webhook.
 */
import { loadOlleEnv } from "./env.js";
import { assertAuthConfig } from "./http/session-auth.js";
import { startInboundServer } from "./inbound-server.js";
import { startTickLoop } from "./tick-loop.js";

loadOlleEnv();
assertAuthConfig();

console.log("[olle] starting mind + inbound (load .env from repo root)");
startInboundServer();
void startTickLoop();
