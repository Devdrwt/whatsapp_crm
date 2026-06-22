# Changelog — Drwintech

> Suivi technique des évolutions, par PR / migration. Format
> conventionnel : `Added` (nouveau), `Changed` (modification de
> comportement existant), `Fixed` (correctif), `Database` (migration
> Supabase). Mise à jour à chaque livraison.

---

## PR 9c — Localisation FR (Parcours / Flows — pages + frame du builder)
**Branche** : `dev`

Surfaces utilisateur du module Parcours (Flows) en français : liste
+ dialog de création (templates + vierge), page détail, page
exécutions (runs), header / status / actions du builder.

### Changed
- [src/app/(dashboard)/flows/page.tsx](../src/app/(dashboard)/flows/page.tsx) :
  header avec badge Bêta, dialog de création (cartes templates +
  blank), card de flow (status, exécutions en ICU plural, actions),
  empty state, descripteur de déclencheur (keyword / first inbound /
  manual), toasts. `STATUS_LABELS` retiré (résolu via
  `t('flows.statuses.*')`).
- [src/app/(dashboard)/flows/[id]/page.tsx](../src/app/(dashboard)/flows/[id]/page.tsx) :
  écran « Parcours introuvable » + bouton retour, toast d'erreur.
- [src/app/(dashboard)/flows/[id]/runs/page.tsx](../src/app/(dashboard)/flows/[id]/runs/page.tsx) :
  titre + sous-titre, empty state, 6 statuts de run (Actif /
  Terminé / Passé à un agent / Expiré / Mis en pause / Échec),
  badge `at {node}`, format de date `date-fns/locale/fr` ou `enUS`,
  durée relative localisée, libellés « variables capturées » /
  « aucun événement ».
- [src/components/flows/flow-builder.tsx](../src/components/flows/flow-builder.tsx) :
  Header (back, name placeholder, status badge, description, dirty
  indicator, boutons Runs / Supprimer / Pause / Activer / Save) +
  toasts. Les sous-formulaires per-node-type (TriggerPanel,
  EntryPicker, NodeCard, AddNodeButton, ValidationPanel et les 9
  configs de nœud) restent en anglais — sujets très techniques
  (var_key / reply_id / next_node_key) pour power-users ; un
  follow-up dédié peut les traduire plus tard sans changer
  l'expérience utilisateur courante.

### Added
- Branche `flows.*` dans [messages/fr.json](../messages/fr.json) /
  [messages/en.json](../messages/en.json) (~115 clés sous `nodes`,
  `statuses`, `list`, `editor`, `runs`, `builder`). Pluriels ICU
  pour `runs` / `nodes`.

### Notes
- Le builder de flow (2 134 lignes) est plus profond que celui des
  automations (1 160 lignes). La frame chrome est traduite, les
  configs de nœud (~1 500 lignes) sont laissées en anglais pour
  l'instant — décision tactique : la valeur i18n par caractère
  traduit est plus haute sur la liste + le détail + les runs que
  sur les Inputs avec labels « Tag id » / « Var key » / « Next
  node key » utilisés par les power-users.

---

## PR 9b — Localisation FR (Automatisations)
**Branche** : `dev`

Module Automatisations entièrement en français : liste avec
templates de démarrage rapide, builder canvas (déclencheur + 11
types d'étapes + conditions branchées), édition, logs d'exécution.

### Changed
- [src/lib/automations/trigger-meta.ts](../src/lib/automations/trigger-meta.ts) :
  `TRIGGER_META` n'a plus de `label` — uniquement `pillClass`. Le
  libellé est traduit via `t('automations.triggers.*')` au call
  site. `formatRelative()` prend désormais un translator + locale
  pour rendre « il y a 5 min » / « 5m ago » selon la langue active.
- [src/app/(dashboard)/automations/page.tsx](../src/app/(dashboard)/automations/page.tsx) :
  header, dropdowns d'action, dialog de suppression, 4 templates
  (Welcome / Out of Office / Lead Qualifier / Follow-Up), card
  (run count en ICU plural, dernier run relatif), toasts.
- [src/components/automations/automation-builder.tsx](../src/components/automations/automation-builder.tsx) :
  TriggerCard, 11 step types (StepEditor + AddButton), branches
  Oui/Non, boutons Save/Save Draft, déplacer haut/bas, preview
  per-step traduit, validation toasts.
- [src/app/(dashboard)/automations/[id]/logs/page.tsx](../src/app/(dashboard)/automations/[id]/logs/page.tsx) :
  header, empty state, badges de statut (Succès / Partiel / Erreur),
  compteur d'étapes en ICU plural, format relatif locale-aware.
- [src/app/(dashboard)/automations/[id]/edit/page.tsx](../src/app/(dashboard)/automations/[id]/edit/page.tsx) :
  message d'erreur + bouton retour.

### Added
- Branche `automations.*` dans [messages/fr.json](../messages/fr.json) /
  [messages/en.json](../messages/en.json) (~140 clés sous `triggers`,
  `triggerHints`, `steps`, `relative`, `page`, `builder`, `logs`,
  `edit`). Compteurs en ICU plural (`{count, plural, ...}`).

### Notes
- Le composant `AutomationBuilder` est très imbriqué (TriggerCard,
  StepList, StepRenderer, StepEditor, ConditionBranches,
  AddButton). Pour éviter ~7 appels `useTranslations` séparés, le
  builder appelle 4 hooks au top-level (`t`, `tSteps`, `tTriggers`,
  `tTriggerHints`) et les passe en props aux sous-composants. Idiom
  « hook au sommet, prop en bas » identique à pipelines-settings.

---

## PR 9a — Localisation FR (Agent IA)
**Branche** : `dev`

Panneau Settings → AI Agent entièrement en français : activation,
nom de l'agent, sélection du modèle (Sonnet / Haiku), personnalité,
base de connaissance, message de repli, toasts.

### Changed
- [src/components/settings/ai-agent-panel.tsx](../src/components/settings/ai-agent-panel.tsx) :
  toutes les chaînes traduites. `MODEL_OPTIONS` réduit à
  `{value, key}` — le label se résout via `t(\`models.${key}\`)`.
  Placeholders et hints en FR (« Café Américano : 5 TND », horaires
  « Lun-Ven 9 h-18 h »).

### Added
- Branche `aiAgent.*` dans [messages/fr.json](../messages/fr.json) /
  [messages/en.json](../messages/en.json) (~25 clés).

---

## PR 8c — Localisation FR (Broadcasts)
**Branche** : `dev`

Module Diffusions entièrement en français : liste paginée avec
indicateur d'envoi en cours, wizard 4 étapes (Modèle → Audience
→ Personnaliser → Envoyer), page détail avec funnel, statistiques,
export CSV, et suppression.

### Changed
- [src/app/(dashboard)/broadcasts/page.tsx](../src/app/(dashboard)/broadcasts/page.tsx) :
  titre, sous-titre, CTAs « Nouvelle diffusion », empty state, 7
  colonnes du tableau, statut traduit via `t('broadcasts.statuses.*')`,
  date au format `toLocaleDateString(locale)`.
- [src/app/(dashboard)/broadcasts/new/page.tsx](../src/app/(dashboard)/broadcasts/new/page.tsx) :
  header, libellés des 4 étapes (Modèle / Audience / Personnaliser
  / Envoyer), toasts d'erreur et de brouillon sauvegardé.
- Steps 1-4 ([step1-choose-template](../src/components/broadcasts/step1-choose-template.tsx),
  [step2-select-audience](../src/components/broadcasts/step2-select-audience.tsx),
  [step3-personalize](../src/components/broadcasts/step3-personalize.tsx),
  [step4-schedule-send](../src/components/broadcasts/step4-schedule-send.tsx)) :
  toutes les chaînes (titres, sous-titres, placeholders, états vides,
  cartes options audience, opérateurs de filtre, types de mapping,
  preview, dialog de confirmation, audience summary avec
  `Intl.NumberFormat(locale)`).
- [src/app/(dashboard)/broadcasts/[id]/page.tsx](../src/app/(dashboard)/broadcasts/[id]/page.tsx) :
  pastille de statut (broadcast + recipient), 6 cartes statistiques,
  funnel, table destinataires avec ses 7 colonnes, dropdown filtre,
  export CSV (headers traduits), suppression inline avec confirmation,
  dates au format locale.

### Added
- Branche `broadcasts.*` dans [messages/fr.json](../messages/fr.json) /
  [messages/en.json](../messages/en.json) (~165 clés organisées par
  surface : `statuses`, `recipientStatuses`, `list`, `wizard`,
  `step1`-`step4`, `detail`).

### Notes
- Les helpers `getBroadcastStatus()` / `getRecipientStatus()` dans
  [src/lib/broadcast-status.ts](../src/lib/broadcast-status.ts)
  retournent toujours `{classes, pulse}` (le `label` reste pour
  compat) — les callers passent désormais par
  `t('broadcasts.statuses.*')` pour afficher les libellés
  traduits. Les tests du helper (vérifient `classes` et `pulse`)
  restent verts.
- Les sous-composants internes (`FunnelChart`) reçoivent leurs
  titres en props depuis le parent pour éviter un 2e
  `useTranslations` dans des composants purement présentationnels.

---

## PR 8b — Localisation FR (Pipelines)
**Branche** : `dev`

Module Pipelines entièrement en français : sélecteur de pipeline,
board Kanban (colonnes par étape), formulaire d'affaire (sheet),
panneau analytics (6 métriques + tooltips explicatifs), réglages
de pipeline (étapes drag & drop, couleurs).

### Changed
- [src/app/(dashboard)/pipelines/page.tsx](../src/app/(dashboard)/pipelines/page.tsx) :
  selector de pipeline, boutons « Ajouter un pipeline / une affaire »,
  empty state, dialog « Nouveau pipeline », toasts.
- [src/components/pipelines/pipeline-board.tsx](../src/components/pipelines/pipeline-board.tsx) :
  zone « Déposez une affaire ici », bouton « Ajouter une affaire »
  par colonne, total monétaire des étapes via `Intl.NumberFormat(locale)`.
- [src/components/pipelines/deal-card.tsx](../src/components/pipelines/deal-card.tsx) :
  pastilles de statut (Gagnée / Perdue), fallback contact, format
  monétaire + date selon la locale active.
- [src/components/pipelines/deal-form.tsx](../src/components/pipelines/deal-form.tsx) :
  sheet entièrement traduit — titre, 7 champs + placeholders,
  section Statut (Marquer comme Gagnée / Perdue / Rouvrir), bouton
  Supprimer + confirmation inline, toasts.
- [src/components/pipelines/pipeline-settings.tsx](../src/components/pipelines/pipeline-settings.tsx) :
  dialog « Gérer le pipeline », formulaire de renommage, drag &
  drop des étapes (aria-label « Glisser pour réorganiser »), ajout
  d'étape + sélection de couleur, confirmation de suppression,
  toasts. `SortableStageRow` et `ColorSwatch` reçoivent leurs
  aria-labels en props depuis le parent (évite un 3e useTranslations
  juste pour deux strings).
- [src/components/pipelines/pipeline-analytics.tsx](../src/components/pipelines/pipeline-analytics.tsx) :
  6 métriques (Affaires totales, Valeur du pipeline, Valeur moyenne,
  Valeur pondérée, Gagnées / Perdues ce mois) avec leurs tooltips
  explicatifs. Aria-label « Comment {label} est calculé »
  paramétré sur le label.

### Added
- Branche `pipelines.*` dans [messages/fr.json](../messages/fr.json) /
  [messages/en.json](../messages/en.json) (~95 clés sous `page`,
  `board`, `card`, `analytics`, `dealForm`, `settings`).

### Notes
- Tous les formats monétaires/dates passent en
  `Intl.NumberFormat(locale)` / `toLocaleDateString(locale)`.
- La devise du board (total par étape) reste en USD pour l'instant
  — multi-devise par org est un sujet à part.

---

## PR 8a — Localisation FR (Contacts)
**Branche** : `dev`

Module Contacts entièrement en français : liste paginée, formulaire
de création / édition, sheet de détail (5 onglets), import CSV.

### Changed
- [src/app/(dashboard)/contacts/page.tsx](../src/app/(dashboard)/contacts/page.tsx) :
  titre, sous-titre, total count (ICU plural), search placeholder,
  6 colonnes du tableau, états vides (avec et sans recherche), CTA
  « Ajouter un contact », pagination (Affichage X-Y / Page N sur M),
  dialog de suppression, toasts d'erreur / succès. Date de création
  formatée via `toLocaleDateString(locale)`.
- [src/components/contacts/contact-form.tsx](../src/components/contacts/contact-form.tsx) :
  titres + descriptions (add / edit), libellés et placeholders des
  4 champs, indication d'indicatif pays, section Tags, boutons
  Créer / Mettre à jour, toasts.
- [src/components/contacts/contact-detail-view.tsx](../src/components/contacts/contact-detail-view.tsx) :
  header sheet, 5 onglets (Détails, Tags, Notes, Champs personnalisés,
  Affaires), tous les champs et leurs boutons Save, états vides,
  formats monétaires + dates `Intl.NumberFormat(locale)` /
  `toLocaleDateString(locale)`, statut deals (Gagnée / Perdue).
- [src/components/contacts/import-modal.tsx](../src/components/contacts/import-modal.tsx) :
  titre + description, zone d'upload, en-têtes de preview, compteurs
  ICU plural (`{count, plural, one {# ligne détectée} other {# lignes
  détectées}}`), résultats Import terminé, boutons Annuler / Fermer /
  Importer N contacts, toasts.

### Added
- Branche `contacts.*` dans [messages/fr.json](../messages/fr.json) /
  [messages/en.json](../messages/en.json) (~85 clés sous `page`,
  `form`, `detail`, `import`). Utilise les pluriels ICU pour les
  compteurs.

### Notes
- Les en-têtes du tableau de prévisualisation CSV (import) sont
  réutilisés depuis `contacts.page.headers.*` — un seul endroit
  pour traduire « Nom / Téléphone / E-mail / Société ».
- `Intl.NumberFormat` et `toLocaleDateString` reçoivent désormais
  le `locale` actif (au lieu d'`'en-US'` codé en dur), pour que
  monnaies et dates suivent l'UI.

---

## PR 7 — Localisation FR (Inbox)
**Branche** : `dev`

Suite de la PR 6. Toute la surface **Inbox** passe en français, sous
la racine i18n `inbox.*`. C'est la surface la plus consultée du
produit — désormais entièrement utilisable sans toucher à l'anglais.

### Changed
- [src/app/(dashboard)/inbox/page.tsx](../src/app/(dashboard)/inbox/page.tsx) :
  bannière « WhatsApp non connecté » traduite.
- [src/components/inbox/conversation-list.tsx](../src/components/inbox/conversation-list.tsx) :
  placeholder de recherche, filtres (Toutes / Ouvertes / En attente /
  Fermées), états vides, libellés « Inconnu » et « Pas encore de
  message ». Le calcul `formatDistanceToNow` honore la locale active
  (`date-fns/locale/fr` ou `enUS`) → les « il y a 2 h » /
  « 2 hours ago » suivent la langue.
- [src/components/inbox/message-thread.tsx](../src/components/inbox/message-thread.tsx) :
  empty state, libellés Status / Assign / Unassign / « (moi) »,
  badges de session (Expirée / N h restantes / N min restantes),
  séparateurs de date (Aujourd'hui / Hier + format de date
  localisé), libellés d'auteur (« Vous » / fallback « Client »),
  toasts d'erreur (envoi, envoi de modèle, assignation, réaction).
  `STATUS_OPTIONS` réduit à `{value, color}` — le label est résolu
  via `t(\`statusOptions.${value}\`)`.
- [src/components/inbox/message-composer.tsx](../src/components/inbox/message-composer.tsx) :
  placeholders (normal et session expirée), bannière 24 h, bouton
  Templates, aria-label d'envoi, indication « Tapez « / » pour
  réponses rapides ».
- [src/components/inbox/message-actions.tsx](../src/components/inbox/message-actions.tsx) :
  aria-labels (Réagir / Répondre / Copier / Réagir avec {emoji}),
  toasts (Rien à copier / Copié / Copie échouée).
- [src/components/inbox/message-bubble.tsx](../src/components/inbox/message-bubble.tsx) :
  badge `Template`, « Réponse bouton », « Position partagée »,
  fallbacks media (« {label} indisponible » → Image / Vidéo / Audio
  / Document), alt d'image, fallback message non supporté.
- [src/components/inbox/reply-quote.tsx](../src/components/inbox/reply-quote.tsx) :
  aria « Annuler la réponse ». Signature de `buildReplyPreview`
  étendue avec un argument `t` (`useTranslations('inbox.replyQuote')`)
  — le caller dans `message-thread` passe le translator. Cleaner que
  de propager un dict statique.
- [src/components/inbox/contact-sidebar.tsx](../src/components/inbox/contact-sidebar.tsx) :
  empty state, en-têtes Tags / Affaires actives / Notes, placeholder
  « Ajouter une note… ».
- [src/components/inbox/template-picker.tsx](../src/components/inbox/template-picker.tsx) :
  titre du dialog, descriptions (pick / fill), états vides, libellés
  Variable / Aperçu / Retour / Envoyer le modèle / Annuler.

### Added
- Branche `inbox.*` dans [messages/fr.json](../messages/fr.json) et
  [messages/en.json](../messages/en.json) (~110 clés organisées par
  composant : `page`, `conversationList`, `thread`, `composer`,
  `actions`, `replyQuote`, `bubble`, `contactSidebar`,
  `templatePicker`).

### Notes
- Date-locale dynamique : `useLocale()` → `fr`/`enUS` de `date-fns`,
  passé à `formatDistanceToNow` (liste de conversations) et `format`
  (séparateurs de jour dans le thread).
- Le test de parité (PR 6) couvre automatiquement les ~110 nouvelles
  clés — si une clé FR est ajoutée sans EN (ou vice-versa), CI rouge.
- Reste pour PR 8-10 : Contacts, Pipelines, Broadcasts, Automations,
  Flows, Settings détaillés.

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
