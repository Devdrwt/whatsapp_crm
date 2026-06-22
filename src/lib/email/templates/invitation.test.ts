import { describe, expect, it } from "vitest";
import { renderInvitationEmail } from "./invitation";

const BASE = {
  inviterName: "Marie Dupont",
  orgName: "Café El Buen Sabor",
  acceptUrl: "https://app.example.com/accept-invite/abc123",
  role: "agent" as const,
};

describe("renderInvitationEmail", () => {
  it("renders a FR invitation with the inviter, org, and URL", () => {
    const out = renderInvitationEmail({ ...BASE, locale: "fr" });
    expect(out.subject).toBe(
      "Marie Dupont vous invite à rejoindre Café El Buen Sabor sur Drwintech",
    );
    expect(out.html).toContain("Marie Dupont");
    expect(out.html).toContain("Café El Buen Sabor");
    expect(out.html).toContain(BASE.acceptUrl);
    expect(out.html).toContain("Accepter l'invitation");
    expect(out.html).toContain('lang="fr"');
    expect(out.text).toContain("Marie Dupont");
    expect(out.text).toContain(BASE.acceptUrl);
  });

  it("renders an EN invitation when locale=en", () => {
    const out = renderInvitationEmail({ ...BASE, locale: "en" });
    expect(out.subject).toBe(
      "Marie Dupont invited you to join Café El Buen Sabor on Drwintech",
    );
    expect(out.html).toContain("Accept invitation");
    expect(out.html).toContain('lang="en"');
  });

  it("HTML-escapes the org name, inviter name and URL", () => {
    const out = renderInvitationEmail({
      locale: "fr",
      inviterName: '<script>alert("xss")</script>',
      orgName: 'Acme & "Co"',
      acceptUrl: "https://example.com/accept-invite/x?utm=<bad>",
      role: "admin",
    });
    expect(out.html).not.toContain("<script>alert");
    expect(out.html).toContain("&lt;script&gt;alert");
    expect(out.html).toContain("Acme &amp; &quot;Co&quot;");
    // Bracket in URL is escaped too
    expect(out.html).toContain("utm=&lt;bad&gt;");
  });

  it("shows the role label translated", () => {
    const fr = renderInvitationEmail({ ...BASE, locale: "fr", role: "admin" });
    expect(fr.html).toContain("<strong>Admin</strong>");
    const en = renderInvitationEmail({ ...BASE, locale: "en", role: "agent" });
    expect(en.html).toContain("<strong>Agent</strong>");
  });

  it("includes the brand mark and an expiry note", () => {
    const out = renderInvitationEmail({ ...BASE, locale: "fr" });
    expect(out.html).toContain("Drwintech");
    expect(out.html).toContain("expire dans 7 jours");
    expect(out.text).toContain("Drwintech — CRM WhatsApp pour les PME");
  });
});
