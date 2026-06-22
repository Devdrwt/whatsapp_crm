'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MessageTemplate } from '@/types';

const CATEGORIES = ['Marketing', 'Utility', 'Authentication'] as const;
const HEADER_TYPES = ['text', 'image', 'video', 'document'] as const;

const categoryColors: Record<string, string> = {
  Marketing: 'bg-purple-600/20 text-purple-600 dark:text-purple-400 border-purple-600/30',
  Utility: 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-600/30',
  Authentication: 'bg-amber-600/20 text-amber-600 dark:text-amber-400 border-amber-600/30',
};

const statusColors: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground border-border',
  Pending: 'bg-yellow-600/20 text-yellow-600 dark:text-yellow-400 border-yellow-600/30',
  Approved: 'bg-primary/20 text-primary border-primary/30',
  Rejected: 'bg-red-600/20 text-rose-600 dark:text-rose-400 border-red-600/30',
};

interface TemplateFormData {
  name: string;
  category: MessageTemplate['category'];
  language: string;
  body_text: string;
  header_type: string;
  footer_text: string;
}

// Meta's language codes are exact — "en" and "en_US" are distinct and a
// template approved under one will be rejected if you send with the other
// (Graph API error #132001 "Template name does not exist in the
// translation"). Default to en_US to match the DB default on
// message_templates.language and the broadcasts sender's fallback.
const emptyForm: TemplateFormData = {
  name: '',
  category: 'Marketing',
  language: 'en_US',
  body_text: '',
  header_type: '',
  footer_text: '',
};

// Common Meta template language codes. The field still accepts any
// string — this just offers autocomplete for the usual suspects. Full
// list: https://developers.facebook.com/docs/whatsapp/api/messages/message-templates#supported-languages
const COMMON_LANGUAGE_CODES = [
  'en_US',
  'en_GB',
  'en',
  'es',
  'es_ES',
  'es_MX',
  'fr',
  'fr_FR',
  'de',
  'it',
  'pt_BR',
  'pt_PT',
  'nl',
  'pl',
  'ru',
  'tr',
  'lt',
];

export function TemplateManager() {
  const supabase = createClient();
  const { user, loading: authLoading, activeOrgId, orgsLoading } = useAuth();
  const t = useTranslations('settings.templates');
  const tStatuses = useTranslations('settings.templates.statuses');

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState<TemplateFormData>(emptyForm);

  useEffect(() => {
    if (authLoading || orgsLoading) return;
    if (!user || !activeOrgId) {
      setLoading(false);
      return;
    }
    fetchTemplates(user.id, activeOrgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, orgsLoading, user?.id, activeOrgId]);

  async function fetchTemplates(_userId: string, orgId: string) {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(t('toasts.nameRequired'));
      return;
    }
    if (!form.body_text.trim()) {
      toast.error(t('toasts.bodyRequired'));
      return;
    }

    try {
      setSaving(true);
      if (!user || !activeOrgId) {
        toast.error(t('toasts.notAuthenticated'));
        return;
      }

      const payload = {
        user_id: user.id,
        org_id: activeOrgId,
        name: form.name.trim(),
        category: form.category,
        language: form.language.trim() || 'en_US',
        body_text: form.body_text.trim(),
        header_type: form.header_type || null,
        footer_text: form.footer_text.trim() || null,
        status: 'Draft' as const,
      };

      const { error } = await supabase
        .from('message_templates')
        .insert(payload);

      if (error) throw error;

      toast.success(t('toasts.created'));
      setDialogOpen(false);
      setForm(emptyForm);
      if (user && activeOrgId) await fetchTemplates(user.id, activeOrgId);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(t('toasts.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Pull approved templates from Meta and upsert them into the local
   * catalog. After this runs, every local row is guaranteed to match
   * something Meta will actually accept on send — stops users getting
   * stuck on error #132001 "Template name does not exist".
   */
  async function handleSyncFromMeta() {
    if (!user || !activeOrgId) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || t('toasts.syncFailedGeneric', { status: res.status }));
      }
      const baseMsg = t('toasts.syncSuccess', { count: data.total });
      const statsMsg =
        data.inserted || data.updated
          ? t('toasts.syncStats', { inserted: data.inserted, updated: data.updated })
          : '';
      toast.success(baseMsg + statsMsg);
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        // Surface per-template failures so users don't trust a green
        // toast that hides silent drift.
        const preview = data.errors.slice(0, 3).map(
          (e: { name: string; language: string; message: string }) =>
            `${e.name} (${e.language})`,
        );
        const suffix =
          data.errors.length > 3
            ? t('toasts.syncFailedMore', { count: data.errors.length - 3 })
            : '';
        toast.error(t('toasts.syncFailedSome', { names: preview.join(', ') }) + suffix);
      }
      if (data.truncated) {
        toast.warning(t('toasts.syncTruncated'));
      }
      await fetchTemplates(user.id, activeOrgId);
    } catch (err) {
      console.error('Template sync error:', err);
      toast.error(err instanceof Error ? err.message : t('toasts.syncFailed'));
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(t('toasts.deleted'));
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('toasts.deleteFailed'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncFromMeta}
            disabled={syncing}
            className="bg-transparent hover:bg-accent"
            title={t('syncTitle')}
          >
            <RefreshCw
              className={`size-4 ${syncing ? 'animate-spin' : ''}`}
            />
            {syncing ? t('syncing') : t('sync')}
          </Button>
          <Button
            onClick={() => {
              setForm(emptyForm);
              setDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            {t('newTemplate')}
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="bg-card border-border ring-0 ring-transparent shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">{t('noTemplatesTitle')}</p>
            <p className="text-muted-foreground text-xs mt-1">{t('noTemplatesHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((template) => (
            <Card key={template.id} className="bg-card border-border ring-0 ring-transparent shadow-card">
              <CardContent className="flex items-start justify-between pt-4">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-foreground">{template.name}</h3>
                    <Badge
                      className={`text-xs border ${categoryColors[template.category] || ''}`}
                    >
                      {template.category}
                    </Badge>
                    <Badge
                      className={`text-xs border ${statusColors[template.status || 'Draft'] || ''}`}
                    >
                      {tStatuses((template.status || 'Draft') as 'Draft' | 'Pending' | 'Approved' | 'Rejected')}
                    </Badge>
                    {template.language && (
                      <span className="text-xs text-muted-foreground uppercase">{template.language}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{template.body_text}</p>
                  {template.footer_text && (
                    <p className="text-xs text-muted-foreground italic">{template.footer_text}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(template.id)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('dialog.title')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('dialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground">{t('dialog.name')}</Label>
              <Input
                placeholder={t('dialog.namePlaceholder')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">{t('dialog.category')}</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    setForm({ ...form, category: val as MessageTemplate['category'] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">{t('dialog.language')}</Label>
                <Input
                  list="template-language-codes"
                  placeholder="en_US"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                />
                <datalist id="template-language-codes">
                  {COMMON_LANGUAGE_CODES.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
                <p className="text-[11px] text-muted-foreground">
                  {t('dialog.languageHint')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{t('dialog.headerType')}</Label>
              <Select
                value={form.header_type}
                onValueChange={(val) => setForm({ ...form, header_type: val || '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('dialog.headerNone')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t('dialog.headerNone')}
                  </SelectItem>
                  {HEADER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{t('dialog.bodyText')}</Label>
              <Textarea
                placeholder={t('dialog.bodyPlaceholder')}
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{t('dialog.footerText')}</Label>
              <Input
                placeholder={t('dialog.footerPlaceholder')}
                value={form.footer_text}
                onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {t('dialog.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('dialog.creating')}
                </>
              ) : (
                t('dialog.create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
