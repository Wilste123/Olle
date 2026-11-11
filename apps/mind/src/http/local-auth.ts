import type { IncomingMessage } from "node:http";
import { Socket } from "node:net";

function clientIp(req: IncomingMessage): string {
  const sock = req.socket as Socket;
  return sock.remoteAddress ?? "";
}

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "";
}

/** Dashboard message POST: localhost only, or `Authorization: Bearer <OLLE_MESSAGE_TOKEN>`. */
export function authorizeLocalMessage(req: IncomingMessage): boolean {
  const token = process.env.OLLE_MESSAGE_TOKEN?.trim();
  if (token) {
    const auth = req.headers.authorization ?? "";
    if (auth === `Bearer ${token}`) return true;
  }
  return isLoopback(clientIp(req));
}
