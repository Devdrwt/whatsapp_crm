import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encrypt } from "./encryption";
import { providerFromConfig, providerKindOf } from "./provider";

// The façade decides which transport an org's traffic takes. Picking the
// wrong one does not fail loudly — it sends a client's message down an
// unofficial socket, or a pilot message to a WABA that never paired it.
// These tests pin the selection rules.

const META_CONFIG = {
  org_id: "11111111-1111-1111-1111-111111111111",
  provider: "meta",
  phone_number_id: "123456789",
  access_token: encrypt("meta-access-token"),
};

const BAILEYS_CONFIG = {
  org_id: "22222222-2222-2222-2222-222222222222",
  provider: "baileys",
  phone_number_id: "21612345678",
  access_token: null,
};

describe("providerKindOf", () => {
  it("returns 'baileys' only for an explicit baileys row", () => {
    expect(providerKindOf(BAILEYS_CONFIG)).toBe("baileys");
  });

  it("returns 'meta' for an explicit meta row", () => {
    expect(providerKindOf(META_CONFIG)).toBe("meta");
  });

  // Rows written before migration 020 have no provider column at all.
  // Defaulting them anywhere but Meta would silently reroute every
  // pre-existing production org.
  it("defaults legacy rows with no provider to 'meta'", () => {
    expect(providerKindOf({ ...META_CONFIG, provider: undefined })).toBe("meta");
    expect(providerKindOf({ ...META_CONFIG, provider: null })).toBe("meta");
  });

  it("defaults an unrecognised provider value to 'meta'", () => {
    expect(providerKindOf({ ...META_CONFIG, provider: "sms" })).toBe("meta");
  });
});

describe("providerFromConfig — Meta", () => {
  it("builds a meta provider from an encrypted token", () => {
    const provider = providerFromConfig(META_CONFIG);
    expect(provider.kind).toBe("meta");
  });

  it("throws when the stored token cannot be decrypted", () => {
    // What a rotated / mismatched ENCRYPTION_KEY looks like. The config
    // route depends on this throwing to show its "reset configuration"
    // banner rather than reporting a healthy connection.
    expect(() =>
      providerFromConfig({ ...META_CONFIG, access_token: "not-ciphertext" }),
    ).toThrow();
  });

  it("throws when a meta row has no token at all", () => {
    expect(() =>
      providerFromConfig({ ...META_CONFIG, access_token: null }),
    ).toThrow(/no access token/i);
  });
});

describe("providerFromConfig — Baileys pilot", () => {
  beforeEach(() => {
    vi.stubEnv("WA_GATEWAY_URL", "http://wa-gateway:4100");
    vi.stubEnv("WA_GATEWAY_TOKEN", "pilot-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds a baileys provider without needing a token", () => {
    const provider = providerFromConfig(BAILEYS_CONFIG);
    expect(provider.kind).toBe("baileys");
  });

  // Templates are a Meta Cloud API object — approval, categories, the
  // 24h-window exemption. There is no honest equivalent over WhatsApp
  // Web, and silently sending the raw template name as text would post
  // gibberish into a customer's chat.
  it("refuses to send templates", async () => {
    const provider = providerFromConfig(BAILEYS_CONFIG);
    await expect(
      provider.sendTemplate({ to: "21612345678", templateName: "hello" }),
    ).rejects.toThrow(/not available on the Baileys pilot/i);
  });

  it("sends text through the gateway's session endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ messageId: "3EB0ABCDEF" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = providerFromConfig(BAILEYS_CONFIG);
    const result = await provider.sendText({
      to: "21612345678",
      text: "bonjour",
    });

    expect(result.messageId).toBe("3EB0ABCDEF");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    // Org-scoped path: the gateway holds one socket per org, so the org
    // id in the URL is what routes to the right WhatsApp identity.
    expect(url).toBe(
      `http://wa-gateway:4100/sessions/${BAILEYS_CONFIG.org_id}/messages`,
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer pilot-token",
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      kind: "text",
      to: "21612345678",
      text: "bonjour",
    });
  });

  it("refuses to call the gateway when it is not configured", async () => {
    vi.stubEnv("WA_GATEWAY_URL", "");
    const provider = providerFromConfig(BAILEYS_CONFIG);
    await expect(
      provider.sendText({ to: "21612345678", text: "bonjour" }),
    ).rejects.toThrow(/WA_GATEWAY_URL is not set/);
  });

  it("refuses to call the gateway without a bearer token", async () => {
    vi.stubEnv("WA_GATEWAY_TOKEN", "");
    const provider = providerFromConfig(BAILEYS_CONFIG);
    await expect(
      provider.sendText({ to: "21612345678", text: "bonjour" }),
    ).rejects.toThrow(/WA_GATEWAY_TOKEN is not set/);
  });

  it("surfaces the gateway's error message and status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: 'Session for org is "logged_out"' }, { status: 502 }),
      ),
    );
    const provider = providerFromConfig(BAILEYS_CONFIG);
    await expect(
      provider.sendText({ to: "21612345678", text: "bonjour" }),
    ).rejects.toThrow(/logged_out/);
  });

  it("reports a non-connected session as a failed connection check", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          state: "pairing",
          phoneNumber: null,
          qr: "data:image/png;base64,xxx",
          pairingCode: null,
          lastError: null,
        }),
      ),
    );
    const provider = providerFromConfig(BAILEYS_CONFIG);
    await expect(provider.verifyConnection()).rejects.toThrow(/pairing/);
  });

  it("reports a connected session with the paired number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          state: "connected",
          phoneNumber: "21612345678",
          qr: null,
          pairingCode: null,
          lastError: null,
        }),
      ),
    );
    const provider = providerFromConfig(BAILEYS_CONFIG);
    await expect(provider.verifyConnection()).resolves.toMatchObject({
      display_phone_number: "21612345678",
    });
  });
});
