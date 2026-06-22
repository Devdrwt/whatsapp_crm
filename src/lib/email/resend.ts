import { Resend } from "resend";

/**
 * Resend client + env gating.
 *
 * Email is opt-in: when `RESEND_API_KEY` is unset, `isEmailEnabled()`
 * returns false and callers skip the send. The existing invitation
 * flow already surfaces a "Copy URL" affordance, so the inviter can
 * still hand-deliver the link — email failure must never break the
 * primary flow.
 *
 * For production:
 *  1. Sign up at resend.com, verify your sending domain.
 *  2. Set RESEND_API_KEY in the runtime env.
 *  3. Set EMAIL_FROM to `Name <noreply@your-domain.com>`.
 */

export const EMAIL_FROM_DEFAULT = "Drwintech <onboarding@resend.dev>";

export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

let cached: Resend | null = null;
function getClient(): Resend | null {
  if (!isEmailEnabled()) return null;
  if (!cached) cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

/**
 * Send an email through Resend. Returns the message id on success,
 * `null` on every failure path — callers log and move on. We never
 * throw; the primary business action (creating the invitation,
 * resetting the password) is already committed before we even get
 * here.
 */
export async function sendEmail(args: SendArgs): Promise<string | null> {
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", args.to);
    return null;
  }
  const from = args.from ?? process.env.EMAIL_FROM ?? EMAIL_FROM_DEFAULT;
  try {
    const { data, error } = await client.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (error) {
      console.error("[email] Resend rejected:", error);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[email] send threw:", err);
    return null;
  }
}
