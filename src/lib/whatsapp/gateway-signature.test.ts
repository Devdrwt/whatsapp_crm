import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  GATEWAY_SIGNATURE_HEADER,
  signGatewayPayload,
  verifyGatewaySignature,
} from "./gateway-signature";

// The gateway is the only component allowed to inject inbound messages
// without a Meta signature, so these tests are the guard on that door.

const SECRET = "pilot-gateway-secret";
const BODY = JSON.stringify({ entry: [{ id: "21612345678" }] });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signGatewayPayload", () => {
  it("produces the sha256= HMAC of the raw body", () => {
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(signGatewayPayload(BODY, SECRET)).toBe(expected);
  });

  it("changes when a single byte of the body changes", () => {
    const a = signGatewayPayload(BODY, SECRET);
    const b = signGatewayPayload(BODY.replace("8", "9"), SECRET);
    expect(a).not.toBe(b);
  });
});

describe("verifyGatewaySignature", () => {
  it("accepts a signature made with the configured secret", () => {
    vi.stubEnv("WA_GATEWAY_SECRET", SECRET);
    expect(verifyGatewaySignature(BODY, signGatewayPayload(BODY, SECRET))).toBe(
      true,
    );
  });

  it("rejects a signature made with a different secret", () => {
    vi.stubEnv("WA_GATEWAY_SECRET", SECRET);
    expect(
      verifyGatewaySignature(BODY, signGatewayPayload(BODY, "wrong-secret")),
    ).toBe(false);
  });

  it("rejects a body that was modified after signing", () => {
    vi.stubEnv("WA_GATEWAY_SECRET", SECRET);
    const signature = signGatewayPayload(BODY, SECRET);
    const tampered = JSON.stringify({ entry: [{ id: "99999999999" }] });
    expect(verifyGatewaySignature(tampered, signature)).toBe(false);
  });

  // Fail-closed is the whole security property: an instance that never
  // configured the pilot must not have a second, unauthenticated way in.
  it("fails closed when WA_GATEWAY_SECRET is unset", () => {
    vi.stubEnv("WA_GATEWAY_SECRET", "");
    expect(verifyGatewaySignature(BODY, signGatewayPayload(BODY, SECRET))).toBe(
      false,
    );
  });

  it("rejects a missing or malformed header", () => {
    vi.stubEnv("WA_GATEWAY_SECRET", SECRET);
    expect(verifyGatewaySignature(BODY, null)).toBe(false);
    expect(verifyGatewaySignature(BODY, "not-a-signature")).toBe(false);
    // Right digest, missing the algorithm prefix the format requires.
    const bare = crypto.createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(verifyGatewaySignature(BODY, bare)).toBe(false);
  });

  it("does not accept a Meta-style signature header value", () => {
    // Meta signs with META_APP_SECRET. If that ever validated here, a
    // gateway compromise could forge Meta traffic and vice versa.
    vi.stubEnv("WA_GATEWAY_SECRET", SECRET);
    const metaStyle =
      "sha256=" +
      crypto
        .createHmac("sha256", "test-meta-app-secret")
        .update(BODY)
        .digest("hex");
    expect(verifyGatewaySignature(BODY, metaStyle)).toBe(false);
  });
});

describe("GATEWAY_SIGNATURE_HEADER", () => {
  it("is distinct from Meta's header", () => {
    // The webhook reads both; sharing a header name would make the two
    // verification paths indistinguishable.
    expect(GATEWAY_SIGNATURE_HEADER).not.toBe("x-hub-signature-256");
  });
});
