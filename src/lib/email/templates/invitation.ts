import type { Locale } from "@/lib/i18n/active-locale";

/**
 * Bilingual invitation email.
 *
 * One self-contained pure function — no Resend dependency, no env
 * lookup. Easy to unit-test (snapshot the rendered HTML) and easy
 * to swap for a React Email template later.
 *
 * Visual style: emerald accent matching the Drwintech brand
 * (oklch(0.62 0.14 165) → #1f9e6a in legacy hex). The HTML is
 * deliberately table-based with inline styles — that's what every
 * 2010-era email client still requires.
 */

export interface InvitationEmailInput {
  /** Language to render in. Defaults to FR if anything unexpected. */
  locale: Locale;
  /** Display name of the inviter — falls back to email address upstream. */
  inviterName: string;
  /** Organization the invitee is joining. */
  orgName: string;
  /** Absolute URL to `/accept-invite/<token>` on the target deployment. */
  acceptUrl: string;
  /** Role assigned on accept — "admin" or "agent". */
  role: "admin" | "agent";
}

export interface RenderedEmail {
  subject: string;
  html: string;
  /** Plain-text fallback for clients that don't render HTML. */
  text: string;
}

/** Tiny i18n helper — no library, no provider. The two languages are
 *  small enough that a lookup object beats wiring next-intl into a
 *  pure utility. */
const STRINGS = {
  fr: {
    subject: (inviter: string, org: string) =>
      `${inviter} vous invite à rejoindre ${org} sur Drwintech`,
    preheader: (org: string) =>
      `Acceptez l'invitation pour rejoindre ${org}.`,
    heading: "Vous avez été invité",
    body: (inviter: string, org: string, role: string) =>
      `${inviter} vous a invité à rejoindre <strong>${org}</strong> sur Drwintech en tant que <strong>${role}</strong>.`,
    cta: "Accepter l'invitation",
    expiryNote: "Ce lien expire dans 7 jours.",
    fallbackPrompt:
      "Le bouton ne fonctionne pas ? Copiez et collez cette URL dans votre navigateur :",
    footer:
      "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.",
    brandTagline: "Drwintech — CRM WhatsApp pour les PME",
    roleLabels: { admin: "Admin", agent: "Agent" },
  },
  en: {
    subject: (inviter: string, org: string) =>
      `${inviter} invited you to join ${org} on Drwintech`,
    preheader: (org: string) => `Accept the invitation to join ${org}.`,
    heading: "You're invited",
    body: (inviter: string, org: string, role: string) =>
      `${inviter} invited you to join <strong>${org}</strong> on Drwintech as <strong>${role}</strong>.`,
    cta: "Accept invitation",
    expiryNote: "This link expires in 7 days.",
    fallbackPrompt:
      "Button not working? Copy and paste this URL into your browser:",
    footer:
      "If you weren't expecting this invitation, you can safely ignore this email.",
    brandTagline: "Drwintech — WhatsApp CRM for SMBs",
    roleLabels: { admin: "Admin", agent: "Agent" },
  },
} as const;

/** Minimal HTML escaping for user-supplied display fields. The org
 *  name and inviter name come from the database — we DO NOT trust
 *  them to be HTML-safe. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderInvitationEmail(
  input: InvitationEmailInput,
): RenderedEmail {
  const t = STRINGS[input.locale] ?? STRINGS.fr;
  const inviter = esc(input.inviterName);
  const org = esc(input.orgName);
  const url = esc(input.acceptUrl);
  const role = t.roleLabels[input.role];

  // Subject for Resend: human plain-text, no HTML escaping (Resend
  // sets its own headers). Title / preheader inside the HTML use the
  // escaped form because the inviter/org names there land in the
  // markup itself.
  const subject = t.subject(input.inviterName, input.orgName);
  const subjectHtml = t.subject(inviter, org);
  const preheaderHtml = t.preheader(org);

  // STRINGS values are author-controlled — no escaping needed, and
  // escaping breaks legitimate apostrophes ("Accepter l'invitation"
  // would become `l&#39;invitation`). User-supplied fields (inviter,
  // org, url) go through esc().
  const html = `<!doctype html>
<html lang="${input.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${subjectHtml}</title>
</head>
<body style="margin:0;padding:0;background:#f6f8f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;color:#11161c;">
  <span style="display:none;font-size:1px;color:#f6f8f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheaderHtml}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f8f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e6ebef;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:9px;background:#1f9e6a;color:#ffffff;font-weight:700;font-size:16px;line-height:36px;text-align:center;">D</div>
                <span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;">Drwintech</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:#11161c;">${t.heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0 32px;color:#3a4654;font-size:15px;line-height:1.55;">
              <p style="margin:0 0 18px 0;">${t.body(inviter, org, role)}</p>
              <p style="margin:0 0 22px 0;color:#6a7585;font-size:13px;">${t.expiryNote}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <a href="${url}" style="display:inline-block;background:#1f9e6a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9px;">${t.cta}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px 32px;color:#6a7585;font-size:12px;line-height:1.5;">
              <p style="margin:0 0 6px 0;">${t.fallbackPrompt}</p>
              <p style="margin:0;word-break:break-all;color:#3a4654;font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;font-size:12px;">${url}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px 32px;border-top:1px solid #f0f3f5;color:#9aa3ad;font-size:12px;line-height:1.5;">
              <p style="margin:0 0 4px 0;">${t.footer}</p>
              <p style="margin:0;color:#b6bdc6;">${t.brandTagline}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text version. Same content, no markup, line breaks at
  // ~72 chars where natural. The blank line between paragraphs keeps
  // most clients from collapsing the lines.
  const text =
    [
      t.heading,
      "",
      // Body without HTML — strip the <strong> tags by re-rendering
      // with raw substitutions.
      input.locale === "fr"
        ? `${input.inviterName} vous a invité à rejoindre ${input.orgName} sur Drwintech en tant que ${role}.`
        : `${input.inviterName} invited you to join ${input.orgName} on Drwintech as ${role}.`,
      "",
      t.expiryNote,
      "",
      t.cta + ":",
      input.acceptUrl,
      "",
      t.footer,
      t.brandTagline,
    ].join("\n");

  return { subject, html, text };
}
