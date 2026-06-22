'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Bot } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AiAgentModel } from '@/types';

const DEFAULT_FALLBACK =
  'Je n’ai pas cette information, je transmets votre demande à un conseiller.';

const MODEL_OPTIONS: { value: AiAgentModel; key: 'sonnet' | 'haiku' }[] = [
  { value: 'claude-sonnet-4-6', key: 'sonnet' },
  { value: 'claude-haiku-4-5-20251001', key: 'haiku' },
];

export function AiAgentPanel() {
  const supabase = createClient();
  const { user, loading: authLoading, activeOrgId, orgsLoading } = useAuth();
  const t = useTranslations('aiAgent');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [agentName, setAgentName] = useState('Assistant');
  const [persona, setPersona] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState(DEFAULT_FALLBACK);
  const [model, setModel] = useState<AiAgentModel>('claude-sonnet-4-6');

  useEffect(() => {
    if (authLoading || orgsLoading) return;
    if (!user || !activeOrgId) {
      setLoading(false);
      return;
    }
    fetchConfig(user.id, activeOrgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, orgsLoading, user?.id, activeOrgId]);

  async function fetchConfig(_userId: string, orgId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_agent_configs')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setEnabled(data.enabled);
        setAgentName(data.agent_name ?? 'Assistant');
        setPersona(data.persona ?? '');
        setKnowledgeBase(data.knowledge_base ?? '');
        setFallbackMessage(data.fallback_message ?? DEFAULT_FALLBACK);
        setModel((data.model as AiAgentModel) ?? 'claude-sonnet-4-6');
      }
    } catch (err) {
      console.error('Failed to fetch AI agent config:', err);
      toast.error(t('toasts.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user || !activeOrgId) {
      toast.error(t('toasts.notAuthenticated'));
      return;
    }
    if (!agentName.trim()) {
      toast.error(t('toasts.nameRequired'));
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.from('ai_agent_configs').upsert(
        {
          user_id: user.id,
          org_id: activeOrgId,
          enabled,
          agent_name: agentName.trim(),
          persona,
          knowledge_base: knowledgeBase,
          fallback_message: fallbackMessage,
          model,
        },
        { onConflict: 'org_id' },
      );
      if (error) throw error;
      toast.success(t('toasts.saved'));
    } catch (err) {
      console.error('Save error:', err);
      toast.error(t('toasts.saveFailed'));
    } finally {
      setSaving(false);
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
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Bot className="size-5" />
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <Card className="bg-card border-border shadow-card">
        <CardContent className="space-y-5 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">{t('enable')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('enableHint')}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">{t('agentName')}</Label>
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder={t('agentNamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">{t('model')}</Label>
            <Select
              value={model}
              onValueChange={(v) => setModel(v as AiAgentModel)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(`models.${o.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">{t('persona')}</Label>
            <Textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder={t('personaPlaceholder')}
              className="min-h-24"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">{t('knowledgeBase')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('knowledgeBaseHint')}
            </p>
            <Textarea
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              placeholder={t('knowledgeBasePlaceholder')}
              className="min-h-40"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">{t('fallbackMessage')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('fallbackMessageHint')}
            </p>
            <Textarea
              value={fallbackMessage}
              onChange={(e) => setFallbackMessage(e.target.value)}
              className="min-h-16"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('save')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
