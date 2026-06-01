import { describe, it, expect, afterEach } from "vitest";
import {
  buildMessages,
  buildSystemBlocks,
  generateAgentReply,
  type HistoryMessage,
} from "./brain";

describe("buildMessages", () => {
  it("maps customer -> user and bot/agent -> assistant", () => {
    const history: HistoryMessage[] = [
      { sender_type: "customer", content_text: "Bonjour" },
      { sender_type: "bot", content_text: "Salut !" },
      { sender_type: "agent", content_text: "Je prends le relais" },
      { sender_type: "customer", content_text: "Merci" },
    ];
    expect(buildMessages(history, 20)).toEqual([
      { role: "user", content: "Bonjour" },
      { role: "assistant", content: "Salut !" },
      { role: "assistant", content: "Je prends le relais" },
      { role: "user", content: "Merci" },
    ]);
  });

  it("drops rows with empty or whitespace-only text", () => {
    const history: HistoryMessage[] = [
      { sender_type: "customer", content_text: "  " },
      { sender_type: "customer", content_text: null },
      { sender_type: "customer", content_text: "Réel" },
    ];
    expect(buildMessages(history, 20)).toEqual([
      { role: "user", content: "Réel" },
    ]);
  });

  it("keeps only the last maxHistory rows", () => {
    const history: HistoryMessage[] = Array.from({ length: 30 }, (_, i) => ({
      sender_type: "customer" as const,
      content_text: `m${i}`,
    }));
    const result = buildMessages(history, 5);
    expect(result).toHaveLength(5);
    expect(result[0].content).toBe("m25");
    expect(result[4].content).toBe("m29");
  });

  it("drops leading assistant turns so the first message is user", () => {
    const history: HistoryMessage[] = [
      { sender_type: "bot", content_text: "Bienvenue, tapez 1 ou 2" },
      { sender_type: "bot", content_text: "Toujours là ?" },
      { sender_type: "customer", content_text: "3" },
    ];
    const result = buildMessages(history, 20);
    expect(result[0]).toEqual({ role: "user", content: "3" });
    expect(result).toHaveLength(1);
  });

  it("returns empty when every message is empty", () => {
    expect(
      buildMessages(
        [{ sender_type: "customer", content_text: "" }],
        20,
      ),
    ).toEqual([]);
  });
});

describe("buildSystemBlocks", () => {
  it("puts the cache breakpoint on the knowledge block, not the identity block", () => {
    const blocks = buildSystemBlocks({
      agentName: "Sofia",
      persona: "Amicale",
      knowledgeBase: "Horaires: 9h-18h",
      fallbackMessage: "Je transmets à un conseiller.",
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].cache_control).toBeUndefined();
    expect(blocks[1].cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[0].text).toContain("Sofia");
    expect(blocks[0].text).toContain("Amicale");
    expect(blocks[1].text).toContain("Horaires: 9h-18h");
  });

  it("embeds the exact fallback phrase when provided", () => {
    const blocks = buildSystemBlocks({
      agentName: "Sofia",
      persona: "",
      knowledgeBase: "",
      fallbackMessage: "Contactez le 12 34 56.",
    });
    expect(blocks[0].text).toContain("Contactez le 12 34 56.");
  });
});

describe("generateAgentReply", () => {
  const original = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = original;
  });

  it("returns null (no network) when ANTHROPIC_API_KEY is absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const reply = await generateAgentReply({
      agentName: "Sofia",
      persona: "",
      knowledgeBase: "x",
      fallbackMessage: "",
      model: "claude-sonnet-4-6",
      history: [{ sender_type: "customer", content_text: "Bonjour" }],
      maxHistory: 20,
    });
    expect(reply).toBeNull();
  });

  it("returns null when there is no usable history (no network)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-not-used";
    const reply = await generateAgentReply({
      agentName: "Sofia",
      persona: "",
      knowledgeBase: "x",
      fallbackMessage: "",
      model: "claude-sonnet-4-6",
      history: [{ sender_type: "customer", content_text: "   " }],
      maxHistory: 20,
    });
    expect(reply).toBeNull();
  });
});
