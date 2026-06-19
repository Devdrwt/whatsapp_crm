import { supabaseAdmin } from "@/lib/flows/admin-client";
import { engineSendText } from "@/lib/flows/meta-send";
import { generateAgentReply, type HistoryMessage } from "./brain";
import type { AiAgentModel } from "@/types";

/**
 * Last-resort AI responder. Runs in the webhook AFTER the flow runner
 * and automations have had their turn. If the AI agent is enabled and
 * nobody else replied to this inbound message, it generates a reply
 * from the org's persona + knowledge base and sends it over WhatsApp.
 *
 * Keyed by user_id today; carries org_id once the multi-tenant refactor
 * lands. Uses the service-role client (RLS bypass) since the webhook has
 * no authenticated user.
 */

interface MaybeRunAiAgentArgs {
  userId: string;
  orgId: string;
  conversationId: string;
  contactId: string;
  /** ISO timestamp of the inbound customer message that triggered this. */
  inboundCreatedAt: string;
}

export async function maybeRunAiAgent(args: MaybeRunAiAgentArgs): Promise<void> {
  const db = supabaseAdmin();

  const { data: config } = await db
    .from("ai_agent_configs")
    .select(
      "enabled, agent_name, persona, knowledge_base, model, fallback_message, max_history",
    )
    .eq("org_id", args.orgId)
    .maybeSingle();

  if (!config?.enabled) return;

  // Anti-double-reply gate: if a flow reprompt or an automation auto-reply
  // already sent something for this inbound, stay silent. Decoupled from
  // those subsystems — "did anyone reply at/after the inbound?" is enough.
  const { count: outboundCount } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", args.conversationId)
    .in("sender_type", ["bot", "agent"])
    .gte("created_at", args.inboundCreatedAt);

  if ((outboundCount ?? 0) > 0) return;

  const maxHistory = config.max_history ?? 20;

  const { data: rows } = await db
    .from("messages")
    .select("sender_type, content_text, created_at")
    .eq("conversation_id", args.conversationId)
    .order("created_at", { ascending: false })
    .limit(maxHistory);

  if (!rows || rows.length === 0) return;

  const history: HistoryMessage[] = rows
    .reverse()
    .map((r) => ({
      sender_type: r.sender_type,
      content_text: r.content_text,
    }));

  const reply = await generateAgentReply({
    agentName: config.agent_name ?? "Assistant",
    persona: config.persona ?? "",
    knowledgeBase: config.knowledge_base ?? "",
    fallbackMessage: config.fallback_message ?? "",
    model: config.model as AiAgentModel,
    history,
    maxHistory,
  });

  if (!reply) return;

  await engineSendText({
    userId: args.userId,
    orgId: args.orgId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    text: reply,
  });
}
