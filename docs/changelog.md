# Changelog — Drwintech

> Suivi technique des évolutions, par PR / migration. Format
> conventionnel : `Added` (nouveau), `Changed` (modification de
> comportement existant), `Fixed` (correctif), `Database` (migration
> Supabase). Mise à jour à chaque livraison.

---

## PR 4 — Multi-agents + invitations
**Branche** : `dev` · **Migration** : `018_invitations_accept_fn.sql`

Un `owner` / `admin` peut désormais **inviter** des collègues à
rejoindre son organisation. L'invité reçoit une **URL d'invitation**
(la branche email transactionnel viendra ensuite), s'inscrit ou se
connecte, accepte l'invitation et atterrit sur l'org. Plusieurs
membres d'une même org partagent toutes ses données — le **multi-agents
opérationnel** est ouvert.

### Added
- Page **Settings → Team** ([src/components/settings/team-panel.tsx](../src/components/settings/team-panel.tsx)) :
  liste des membres avec rôle, liste des invitations en attente,
  dialog d'invitation (email + rôle `admin` / `agent`), actions
  « copier URL » / « révoquer » / « changer rôle » / « retirer ».
- Page **`/accept-invite/[token]`** ([src/app/accept-invite/[token]/page.tsx](../src/app/accept-invite/[token]/page.tsx)) :
  parcours d'acceptation, gestion d'erreurs typées (token introuvable,
  expiré, déjà accepté, email ne matche pas).
- API : [`/api/orgs/invitations`](../src/app/api/orgs/invitations/route.ts)
  (GET liste / POST upsert), [`/api/orgs/invitations/[id]`](../src/app/api/orgs/invitations/[id]/route.ts)
  (DELETE révoque), [`/api/orgs/members`](../src/app/api/orgs/members/route.ts)
  (GET liste), [`/api/orgs/members/[userId]`](../src/app/api/orgs/members/[userId]/route.ts)
  (PATCH rôle / DELETE retire), [`/api/orgs/accept-invitation`](../src/app/api/orgs/accept-invitation/route.ts)
  (POST — appelle la RPC, set cookie d'org).
- **`useAuth().activeOrg`** : dérive l'`OrganizationWithRole` actif
  depuis `orgs` + `activeOrgId`. Utilisé partout pour les gardes par
  rôle (`activeOrg.role`).

### Changed
- [src/components/inbox/message-thread.tsx](../src/components/inbox/message-thread.tsx) :
  la liste des assignees ne charge plus tous les profiles existants
  mais **uniquement les membres de l'org active** (jointure
  `org_members ↔ profiles`). Plus de profils d'autres orgs visibles.
- [src/app/(dashboard)/settings/page.tsx](../src/app/(dashboard)/settings/page.tsx) :
  nouvel onglet **Team** (icône `Users`) entre Tags et AI Agent.
  Visible à tous les membres ; les actions mutantes sont gardées dans
  le panel (admin / owner).
- [src/middleware.ts](../src/middleware.ts) : route `/accept-invite/*`
  ajoutée comme « auth requise, org pas requise » — un user invité y
  arrive avant de devenir membre. Sur les redirects vers `/login`,
  la query string `?next=…` est désormais propagée.
- [src/app/(auth)/login/page.tsx](../src/app/(auth)/login/page.tsx) :
  lit `?next` (validation anti open-redirect — doit commencer par `/`),
  redirige sur cette URL après login, propage `?next` sur le lien
  « Create account ».

### Database
- Fonction `accept_invitation(p_token TEXT) RETURNS UUID`
  `SECURITY DEFINER` : valide le token (existence, expiration,
  acceptation), match email JWT vs invitation, insert atomique dans
  `org_members` + marque `accepted_at`. Erreurs typées
  (`invitation_not_found`, `invitation_already_accepted`,
  `invitation_expired`, `invitation_email_mismatch`,
  `not_authenticated`) que l'API mappe en codes HTTP (410 / 403 / 401).

### Notes
- **Email transactionnel** : encore hors scope. L'inviteur copie
  l'URL et la transmet manuellement. Brancher Resend / SendGrid
  viendra dans une PR dédiée.
- **Transfert de propriété** et **suppression d'org** : pas encore
  exposés. Un owner ne peut pas se retirer lui-même.

---

## PR 3 — Multi-tenant lock (RLS org-based)
**Branche** : `dev` · **Migration** : `017_org_id_lock.sql`

L'**isolation inter-organisation est désormais garantie au niveau
Postgres**. Un membre d'une org ne peut plus accéder aux données
d'une autre org, même avec son propre JWT. Plusieurs membres dans une
même org partagent toutes ses données → **prêt pour le multi-agents
en PR 4**.

### Database
- `ALTER COLUMN org_id SET NOT NULL` sur les **25 tables tenant**
  (16 directes + 9 dérivées).
- **Drop** des anciennes policies `auth.uid() = user_id` (24 policies
  au total, voir le plan PR 3 pour la liste). `profiles` reste
  identity-keyed (RLS inchangée).
- **Create** des nouvelles policies `FOR ALL USING (user_in_org(org_id))
  WITH CHECK (user_in_org(org_id))` — patron unique pour 21 tables.
- **`message_reactions`** : 4 policies recréées avec la nuance
  agent-self préservée sur DELETE/UPDATE (un agent ne peut modifier
  que sa propre réaction, même dans la même org).
- **`flow_runs` / `flow_run_events`** : SELECT-only côté user (writes
  via service_role).
- `whatsapp_config.UNIQUE(user_id)` → `UNIQUE(org_id)`. Idem
  `ai_agent_configs`. Un numéro WhatsApp / une config IA par **org**,
  pas par user.
- Index partiel `flow_runs(user_id, contact_id) WHERE status='active'`
  → `(org_id, contact_id)`. Un même contact peut maintenant avoir un
  run actif distinct par org.

### Changed
- [src/components/settings/ai-agent-panel.tsx](../src/components/settings/ai-agent-panel.tsx) :
  `upsert(..., { onConflict: 'user_id' })` → `onConflict: 'org_id'`
  (l'UNIQUE de référence est désormais `(org_id)`).

### Notes
- Les colonnes `user_id` restent NOT NULL sur les tables tenant et
  continuent à être tamponnées sur chaque INSERT. Elles servent
  d'audit (« qui a créé cette ligne ») ; la RLS n'en a juste plus
  besoin.
- `automation_pending_executions` reste service-role only (cron).

---

## PR 2 — Multi-tenant expand (`org_id` partout)
**Branche** : `dev` · **Commit** : `d789447` · **Migration** : `016_org_id_expand.sql`

Toutes les tables tenant ont maintenant une colonne `org_id`, back-fillée
depuis l'organisation propriétaire, et tous les call sites de l'app
filtrent et stampent par `org_id`. RLS reste `auth.uid() = user_id`
(à bascule en PR 3).

### Database
- Ajout d'une colonne `org_id UUID NULL REFERENCES organizations(id)
  ON DELETE CASCADE` + index `idx_<table>_org` sur les **25 tables
  tenant** (16 directes + 9 dérivées).
- **Backfill** des tables directes depuis `organizations.owner_id`.
- **Backfill** des tables dérivées depuis l'`org_id` du parent.

### Changed
- **UI client** (15 fichiers) : swap `.eq('user_id', user.id)` →
  `.eq('org_id', activeOrgId)`, gate des `useEffect` sur
  `activeOrgId` + `orgsLoading`, ajout de `org_id: activeOrgId` à
  chaque INSERT payload (le `user_id` est conservé tant que la RLS
  est user-based). `profile-form.tsx` laissé tel quel (identité).
- **Routes API** (10 fichiers) : résolution de
  `orgId = await getActiveOrgIdFromCookies()` dans chaque handler,
  swap des lectures, ajout de `org_id` aux inserts. **400** si pas
  d'org active.
- **Engines** (5 fichiers : `automations/engine.ts`,
  `automations/meta-send.ts`, `flows/engine.ts`, `flows/meta-send.ts`,
  `ai-agent/responder.ts`) : signature des entry points enrichie d'un
  argument `orgId: string` ; lectures internes swappées ;
  propagation à `engineSendText` / `engineSendInteractive*`.
- **Webhook** [src/app/api/whatsapp/webhook/route.ts](../src/app/api/whatsapp/webhook/route.ts) :
  lecture de `org_id` sur la ligne `whatsapp_config` résolue par
  `phone_number_id` (skip + log défensif si null), threading de
  `orgId` à travers `processMessage` / `findOrCreateContact` /
  `findOrCreateConversation`, et tamponnage sur les INSERTs
  `contacts` / `conversations` / `messages`.
- **Crons** : lecture de `org_id` sur les pending rows et
  propagation aux appels d'engine.
- **Route `/api/automations/engine`** (déclenchement manuel) :
  branchée sur `getActiveOrgIdFromCookies()` au lieu de faire
  confiance au body.

### Fixed
- 2 erreurs ESLint `react-hooks/set-state-in-effect` (React 19)
  introduites par les gates `activeOrgId` — supprimées localement
  avec un commentaire ; le pattern est intentionnel (skip).

---

## PR 1 — Multi-tenant socle (organisations)
**Branche** : `dev` · **Commit** : `76fefde` · **Migration** : `015_multitenancy_core.sql`

Drwintech devient multi-tenant côté schéma : un utilisateur peut
appartenir à plusieurs organisations, chaque org est l'unité de
propriété des données. PR 1 pose la fondation sans toucher aux 25
tables existantes — celles-ci sont migrées en PR 2 / PR 3.

### Added
- Nouvelles tables `organizations`, `org_members`, `org_invitations`.
- Helpers RLS `SECURITY DEFINER` : `user_in_org(org_id)`,
  `user_org_role(org_id)`, et `create_organization(p_name)` —
  procédure atomique de création org + insert owner (granted
  `authenticated`).
- Backfill automatique : une org créée pour chaque `profile`
  existant (l'utilisateur est `owner`).
- Helper serveur [src/lib/orgs/active-org.ts](../src/lib/orgs/active-org.ts) :
  cookie httpOnly `drwintech.org-id` (30 jours).
- Page [src/app/onboarding/create-org](../src/app/onboarding/create-org/page.tsx)
  + layout `onboarding`.
- Route API [`/api/orgs/active`](../src/app/api/orgs/active/route.ts) :
  `GET` (lit cookie) + `POST` (valide l'appartenance via RLS, set
  cookie).
- `useAuth()` étendu : `orgs`, `activeOrgId`, `orgsLoading`,
  `switchOrg(orgId)`, `refreshOrgs()`.
- Composant [OrgSwitcher](../src/components/layout/org-switcher.tsx) intégré
  dans le header (entre le titre et le toggle clair/sombre).

### Changed
- [src/middleware.ts](../src/middleware.ts) : après `getUser()`, requête
  `org_members` pour le user ; si 0 org → redirect
  `/onboarding/create-org` ; sinon synchronise le cookie `org-id` sur
  la 1re org valide.

### Fixed
- Route group renommée `src/app/(onboarding)/` → `src/app/onboarding/`
  (les parenthèses Next.js auraient fait servir la page à
  `/create-org` au lieu de `/onboarding/create-org`).

---

## Drwintech v1 — Rebrand + design system + Agent IA
**Branche** : `dev` · **Commit** : `76fefde` (initial multi-feature)

Import du template `wacrm` et transformation en produit propriétaire
Drwintech.

### Added
- **Agent IA** (Settings → AI Agent) — réponses LLM en langage
  naturel à partir d'une base de connaissance par compte, avec
  prompt caching Anthropic, garde-fou anti-double-réponse côté
  webhook, et bascule humain via fallback message. Modèles Sonnet 4.6
  et Haiku 4.5.
- Migration `014_ai_agent.sql`.

### Changed
- **Design system propriétaire Drwintech** : clair (`:root`) + sombre
  (`.dark`) avec accent émeraude, Plus Jakarta Sans pour les titres,
  rayons et ombres custom. Bascule clair/sombre/système.
- **Rebrand** wacrm → Drwintech : monogramme + wordmark,
  favicon émeraude, métadonnées `<title>`, frame d'auth.
- **Token migration** sur tout le code : ~1000 classes `slate-*`
  remplacées par des tokens sémantiques (`bg-card`, `text-foreground`,
  `border-border`, `text-muted-foreground`, etc.). Charts SVG pilotés
  par CSS variables.
- **Sidebar** : nouvelle pastille bascule clair/sombre + bouton
  réduire/élargir persistant (localStorage).

### Database
- Migration `014_ai_agent.sql` (table `ai_agent_configs`).
