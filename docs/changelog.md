# Changelog — Drwintech

> Suivi technique des évolutions, par PR / migration. Format
> conventionnel : `Added` (nouveau), `Changed` (modification de
> comportement existant), `Fixed` (correctif), `Database` (migration
> Supabase). Mise à jour à chaque livraison.

---

## PR 6 — Localisation FR (socle i18n + frame)
**Branche** : `dev` · **Dépendance** : `next-intl@^4`

**Bloqueur #1 levé** avant le 1er client payant : Drwintech cible des
PME francophones (Tunisie, Afrique de l'Ouest) mais l'UI était
entièrement en anglais. PR 6 installe le **socle i18n** et traduit
les **surfaces visibles partout** (auth, onboarding, accept-invite,
sidebar, header, org-switcher, settings shell + Appearance). Les
PRs 7-10 traduiront ensuite chaque module (inbox, contacts,
pipelines, broadcasts, automations, flows, settings détaillés).

### Added
- **next-intl v4** wiring : plugin dans [next.config.ts](../next.config.ts),
  fichier [i18n/request.ts](../i18n/request.ts) qui lit la locale
  côté serveur, `NextIntlClientProvider` dans le root layout.
- [src/lib/i18n/active-locale.ts](../src/lib/i18n/active-locale.ts) :
  helpers cookie `drwintech.locale` (1 an), parallèles à
  `active-org.ts`. Constantes `SUPPORTED_LOCALES = ['fr', 'en']`,
  `DEFAULT_LOCALE = 'fr'`.
- [src/app/api/locale/route.ts](../src/app/api/locale/route.ts) :
  GET (lecture) / POST (bascule + cookie).
- [src/components/settings/locale-selector.tsx](../src/components/settings/locale-selector.tsx) :
  Select FR / EN dans le panneau Appearance, valeur optimiste +
  `router.refresh()` au changement.
- [messages/fr.json](../messages/fr.json) et [messages/en.json](../messages/en.json) :
  arborescence de clés sémantiques (`auth.*`, `onboarding.*`,
  `acceptInvite.*`, `layout.*`, `settings.*`, `common.*`).
- Tests : [src/lib/i18n/active-locale.test.ts](../src/lib/i18n/active-locale.test.ts)
  (validation + cookie fallback) + [src/lib/i18n/messages-parity.test.ts](../src/lib/i18n/messages-parity.test.ts)
  (assure que `fr.json` et `en.json` ont **exactement** les mêmes
  clés, et qu'aucune n'est vide).

### Changed
- [src/app/layout.tsx](../src/app/layout.tsx) : `<html lang>`
  désormais dynamique (lu depuis la locale active), wrapping
  `<NextIntlClientProvider>` autour de tout l'arbre.
- Surfaces traduites (clés sous `auth.*`, `onboarding.*`,
  `acceptInvite.*`, `layout.*`, `settings.tabs.*`,
  `settings.appearance.*`, `settings.locale.*`) :
  - Auth : login, signup, forgot-password.
  - Onboarding : create-org.
  - Accept-invite : 6 codes d'erreur typés en FR.
  - Frame dashboard : sidebar, header, org-switcher.
  - Settings shell : titre + sous-titre + 7 onglets, appearance-panel.

### Notes
- **Routing cookie-based, pas de préfixe URL** : les routes restent
  `/dashboard`, `/inbox`, etc. La locale est un cookie
  `drwintech.locale` (1 an). Aucune dette de routing à payer plus
  tard.
- **Source-of-truth = clés sémantiques en anglais**. Les deux JSON
  contiennent toutes les chaînes traduites.
- **Hors PR 6** : tous les modules (inbox, contacts, pipelines,
  broadcasts, automations, flows, team-panel, ai-agent-panel, et
  les autres onglets de Settings) restent en anglais — sujet des
  PRs 7-10.
- **AR + RTL** : sujet à part (polices arabes, sens d'écriture
  inverse, miroir CSS). Plus tard.

---

## PR 5 — Tests d'isolation cross-org au CI
**Branche** : `dev`

**Filet de sécurité non négociable** avant le 1er client payant
(étude de faisabilité §4.9). Une suite Vitest qui prouve, sur 6
tables sensibles, que la RLS org-based de PR 3 isole correctement
les organisations entre elles.

### Added
- [src/lib/orgs/isolation.test.ts](../src/lib/orgs/isolation.test.ts) :
  suite cross-org. Pour chaque table (`contacts`, `tags`,
  `broadcasts`, `flows`, `ai_agent_configs`, `conversations`),
  3 invariants asserts :
  1. Owner CAN insert+read in his own org.
  2. Member CANNOT see rows from another org (RLS USING).
  3. Member CANNOT insert with another org's `org_id` (RLS WITH CHECK).
- [src/lib/orgs/__test-utils.ts](../src/lib/orgs/__test-utils.ts) :
  helpers `createAdminClient`, `createTestUser` (signup via admin +
  signIn), `createOrgFor` (RPC `create_organization`),
  `cleanup` (DELETE org puis user, ordre dicté par
  `organizations.owner_id ON DELETE RESTRICT`).
- [.env.test.example](../.env.test.example) : documente les 3 env
  vars nécessaires et la procédure de provisionnement d'un projet
  Supabase de test.

### Changed
- [vitest.config.ts](../vitest.config.ts) : forward
  `TEST_SUPABASE_URL` / `TEST_SUPABASE_ANON_KEY` /
  `TEST_SUPABASE_SERVICE_ROLE_KEY` depuis `process.env` vers le
  runtime des tests (default `""` si absent).

### Notes
- **Opt-in** : sans la trio `TEST_SUPABASE_*`, la suite `skipIf`
  proprement. `npm test` et le CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml))
  continuent de passer (171 tests existants, suite d'isolation grise).
- **Use a DEDICATED test Supabase project** — la suite crée et détruit
  des vrais users / orgs / rows. Ne jamais pointer sur dev ou prod.
- **Brancher dans le CI** : créer 3 GitHub Secrets, les exposer dans
  le bloc `env:` du job `check`. Sujet d'une PR ops dédiée quand le
  projet de test sera prêt.

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
