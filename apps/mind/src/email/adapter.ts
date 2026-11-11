import type { PermissionRequestRecord } from "@olle/protocol";

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
}

export interface EmailAdapter {
  send(msg: OutboundEmail): Promise<void>;
  sendPermissionRequest(req: PermissionRequestRecord): Promise<void>;
}

export class MockEmailAdapter implements EmailAdapter {
  readonly sent: OutboundEmail[] = [];

  async send(msg: OutboundEmail): Promise<void> {
    this.sent.push(msg);
    if (process.env.OLLE_VERBOSE === "1") {
      console.log("[mock-email]", msg.subject);
    }
  }

  async sendPermissionRequest(req: PermissionRequestRecord): Promise<void> {
    const body = [
      "Hi William,",
      "",
      `I'd like permission for: ${req.action_id}`,
      "",
      JSON.stringify(req.params, null, 2),
      "",
      `Reply YES ${req.id} to approve, NO ${req.id} to decline.`,
      `Or run: olle permit approve ${req.id}`,
      "",
      `Expires: ${req.expires_at}`,
      "",
      "— Olle",
    ].join("\n");
    await this.send({
      to: process.env.WILLIAM_EMAIL ?? "william@example.com",
      subject: `[Olle] Permission: ${req.action_id}`,
      body,
    });
  }
}

/** Resend adapter — active when RESEND_API_KEY is set. */
export class ResendEmailAdapter implements EmailAdapter {
  constructor(private apiKey: string, private from: string) {}

  async send(msg: OutboundEmail): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.body,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
    }
  }

  async sendPermissionRequest(req: PermissionRequestRecord): Promise<void> {
    const body = [
      "Hi William,",
      "",
      `I'd like permission for: ${req.action_id}`,
      "",
      JSON.stringify(req.params, null, 2),
      "",
      `Reply YES ${req.id} to approve, NO ${req.id} to decline.`,
      "",
      `Expires: ${req.expires_at}`,
      "",
      "— Olle",
    ].join("\n");
    await this.send({
      to: process.env.WILLIAM_EMAIL ?? "william@example.com",
      subject: `[Olle] Permission: ${req.action_id}`,
      body,
    });
  }
}

export function createEmailAdapter(): EmailAdapter {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.OLLE_EMAIL_FROM ?? "olle@example.com";
  if (key) return new ResendEmailAdapter(key, from);
  return new MockEmailAdapter();
}
