"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface ReplyQuoteProps {
  /** Sender label of the quoted message: "You" for our own messages,
   *  contact name for customer-sent messages. Caller resolves this — the
   *  quote component doesn't see the parent Message. */
  authorLabel: string;
  /** Compact text preview. Falls back to a placeholder for media types. */
  preview: string;
  /** Present → renders the composer-chip variant with an X button. Absent →
   *  renders the embedded-in-bubble variant. */
  onDismiss?: () => void;
}

export function ReplyQuote({
  authorLabel,
  preview,
  onDismiss,
}: ReplyQuoteProps) {
  const t = useTranslations("inbox.replyQuote");
  const isChip = !!onDismiss;
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-l-2 border-primary px-2 py-1",
        isChip
          ? "rounded-md bg-muted/80"
          : "mb-1.5 rounded-md bg-black/20",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-primary">
          {authorLabel}
        </div>
        <div className="truncate text-xs text-muted-foreground">{preview}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("cancelAria")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Resolve the preview-text key in `inbox.replyQuote.previews` for a
 *  message that has no text body. */
function previewKey(
  contentType: Message["content_type"],
): "image" | "video" | "audio" | "document" | "location" | "template" | "fallback" {
  switch (contentType) {
    case "image":
    case "video":
    case "audio":
    case "document":
    case "location":
    case "template":
      return contentType;
    default:
      return "fallback";
  }
}

/**
 * Build the one-line preview text shown inside a reply quote.
 *
 * Accepts a `t` translator scoped to `inbox.replyQuote` so callers in
 * client components (message-thread) can pass `useTranslations(...)`
 * straight through — no extra plumbing per call site.
 */
export function buildReplyPreview(
  message: Message,
  t: (key: `previews.${ReturnType<typeof previewKey>}`) => string,
): string {
  if (message.content_text) return message.content_text;
  return t(`previews.${previewKey(message.content_type)}`);
}
