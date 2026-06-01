import Anthropic from "@anthropic-ai/sdk";
import type { AiAgentModel } from "@/types";

/**
 * AI-agent "brain": turns a conversation + business knowledge into a
 * natural-language reply via the Anthropic Messages API.
 *
 * The persona + knowledge base form a stable system prefix marked with
 * `cache_control` so repeated turns (and other customers of the same
 * org) read it from cache instead of re-billing it. The volatile part
 * (conversation history) sits after the breakpoint in `messages`.
 */

export interface HistoryMessage {
  sender_type: "customer" | "agent" | "bot";
  content_text: string | null;
}

export interface GenerateReplyArgs {
  agentName: string;
  persona: string;
  knowledgeBase: string;
  fallbackMessage: string;
  model: AiAgentModel;
  history: HistoryMessage[];
  maxHistory: number;
}

const MAX_TOKENS = 512;

/**
 * Map stored `messages` rows to Anthropic turns. Pure — no network.
 *
 * - customer -> user, bot/agent -> assistant
 * - drops rows with empty text
 * - keeps the last `maxHistory` rows
 * - drops leading assistant turns (the API requires the first message
 *   to be `user`; consecutive same-role turns are merged server-side,
 *   so no manual merging is needed)
 */
export function buildMessages(
  history: HistoryMessage[],
  maxHistory: number,
): Anthropic.MessageParam[] {
  const mapped: Anthropic.MessageParam[] = [];
  for (const m of history) {
    const text = m.content_text?.trim();
    if (!text) continue;
    mapped.push({
      role: m.sender_type === "customer" ? "user" : "assistant",
      content: text,
    });
  }

  const trimmed = maxHistory > 0 ? mapped.slice(-maxHistory) : mapped;

  let start = 0;
  while (start < trimmed.length && trimmed[start].role === "assistant") {
    start++;
  }
  return trimmed.slice(start);
}

/**
 * Assemble the cached system prefix. Pure — no network. The knowledge
 * base carries the `cache_control` breakpoint: persona + knowledge are
 * cached together, conversation history (in `messages`) is not.
 */
export function buildSystemBlocks(args: {
  agentName: string;
  persona: string;
  knowledgeBase: string;
  fallbackMessage: string;
}): Anthropic.TextBlockParam[] {
  const persona = args.persona.trim();
  const knowledge = args.knowledgeBase.trim();
  const fallback = args.fallbackMessage.trim();

  const identity =
    `Tu es ${args.agentName}, l'assistant virtuel du service client sur WhatsApp.` +
    (persona ? `\n\n${persona}` : "") +
    `\n\nRéponds dans la langue du client, de façon concise et utile. ` +
    `Ne fournis que des informations présentes dans la base de connaissance ci-dessous ; ` +
    `n'invente jamais de prix, d'horaires ou de disponibilités.` +
    (fallback
      ? `\n\nSi la réponse ne se trouve pas dans la base de connaissance, ` +
        `réponds exactement : « ${fallback} »`
      : `\n\nSi tu ne connais pas la réponse, dis-le simplement sans inventer.`);

  return [
    { type: "text", text: identity },
    {
      type: "text",
      text: knowledge
        ? `# Base de connaissance\n\n${knowledge}`
        : "# Base de connaissance\n\n(vide)",
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * Generate a reply. Returns null when there's nothing to answer, no API
 * key is configured, or the call fails — callers then no-op (no message
 * is sent), so a missing key or transient error never breaks the webhook.
 */
export async function generateAgentReply(
  args: GenerateReplyArgs,
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[ai-agent] ANTHROPIC_API_KEY not set — skipping reply");
    return null;
  }

  const messages = buildMessages(args.history, args.maxHistory);
  if (messages.length === 0) return null;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: args.model,
      max_tokens: MAX_TOKENS,
      system: buildSystemBlocks(args),
      messages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return text || null;
  } catch (err) {
    console.error("[ai-agent] Anthropic call failed:", err);
    return null;
  }
}
