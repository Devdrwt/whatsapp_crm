# Étude de faisabilité — wacrm en SaaS WhatsApp CRM & Automation

> Document interne Drwintech — Dernière mise à jour : 2026-05-28
>
> **Objectif visé** : transformer le template `wacrm` en **SaaS multi-clients**
> (multi-tenant), facturé à l'abonnement, à destination des **PME francophones
> (Tunisie / Afrique francophone)**.

---

## 1. Résumé exécutif

Le template `wacrm` est un produit **WhatsApp CRM & Automation déjà fonctionnel**
et techniquement solide (Next.js 16, Supabase, API officielle WhatsApp Business).
Il couvre déjà les deux moitiés du produit : le **CRM** (inbox, contacts,
pipelines, broadcasts) et l'**Automation** (moteur no-code + chatbot à branches).

**Verdict : GO conditionnel.** Le projet est faisable et le marché est réel,
mais le code ne représente que ~40 % du chantier. Le passage de « template
mono-locataire » à « SaaS revendable » repose sur trois chantiers principalement
**hors-code**, qui décident du go/no-go bien plus que la qualité technique :

1. **Isolation multi-clients** (refonte modèle de données + RLS) — risque maîtrisable.
2. **Onboarding WhatsApp des clients** (accès à l'API Meta) — le vrai goulot, réglementaire.
3. **Encaissement local** (pas de Stripe en Tunisie) — contrainte structurante du modèle.

**Recommandation stratégique : go-to-market hybride.** Commencer à **vendre dès
maintenant le service managé** (une instance dédiée par client, ce que le code
fait déjà) pour valider la demande et générer du revenu, **pendant** la
construction de la version multi-tenant. Ne pas lancer le SaaS en « big bang ».

**Levier décisif propre à Drwintech** : base client locale existante (notamment
GED intelligent), support en français/arabe, paiement local, et pont possible
GED ↔ WhatsApp. C'est ce qui manque aux concurrents internationaux.

---

## 2. État des lieux — analyse du projet existant

### 2.1 Pile technique

| Dimension | État |
|---|---|
| Application | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Données | Supabase (Postgres + Auth + Storage + RLS) |
| WhatsApp | Meta Cloud API (API officielle WhatsApp Business) |
| Déploiement | Hostinger Node.js managé (« zéro ops » pour démarrer) |
| Maturité | v0.2.1 — 148 fichiers TS/TSX, 13 migrations, changelog soigné, tests Vitest + CI |
| Licence | MIT — forkable et commercialisable sans restriction |

### 2.2 Modules déjà livrés

**Volet CRM**
- Inbox WhatsApp partagée (conversations, statuts open/pending/closed, assignation, notes)
- Contacts + tags + champs personnalisés + import CSV + déduplication
- Pipelines Kanban + deals (valeur, devise, date de clôture)
- Broadcasts (templates Meta approuvés, suivi livré / lu / répondu, substitution de variables)
- Dashboard temps réel (temps de réponse, volume, valeur du pipeline)

**Volet Automation** (deux moteurs distincts, fonctionnels)
- **Automations** — no-code : déclencheurs (message entrant, nouveau contact,
  mot-clé, horaire), branches conditionnelles, étapes d'attente (drain par cron),
  tags, webhooks. Builder visuel.
- **Flows** — chatbot conversationnel à branches : menus à boutons, listes,
  capture de réponses (`collect_input`), conditions, set_tag, interpolation
  `{{vars.X}}`. Templates prêts (Welcome menu, FAQ bot, Lead capture).
  Idempotent sur l'ID de message Meta.

### 2.3 Sécurité (déjà en place)

- Chiffrement des tokens WhatsApp en **AES-256-GCM** (authentifié ; format legacy
  CBC décrypté en lecture seule pour rétro-compatibilité).
- **RLS sur chaque table**.
- Webhooks **vérifiés par signature HMAC-SHA256** (Meta App Secret).
- En-têtes de sécurité OWASP (HSTS, X-Frame-Options, Permissions-Policy) + CSP
  (en mode report-only, à passer en enforce).
- Rate-limiting, comparaison constante des secrets cron, redaction PII dans les
  events de flow.

### 2.4 Fait architectural structurant

Le template est **mono-locataire par numéro WhatsApp**. La RLS est partout
`auth.uid() = user_id` ; le multi-agents sur une même inbox n'est **pas**
supporté. C'est le point le plus important pour l'objectif visé : **tel quel,
ce n'est pas un SaaS multi-clients.**

---

## 3. Objectif visé et écart à combler (gap analysis)

| Domaine | État actuel | Requis pour le SaaS | Ampleur |
|---|---|---|---|
| Tenance | Mono-locataire (`auth.uid() = user_id`) | Organisations + membres + rôles ; `org_id` partout ; RLS par appartenance | Élevé |
| Onboarding WhatsApp | Le client colle son token + phone_number_id Meta | Embedded Signup (quelques clics) via Tech Provider ou BSP | Critique |
| Facturation | Aucune | Abonnements, quotas par plan, compteurs d'usage, paiement local | Élevé |
| Multi-agents | Non supporté (1 humain / inbox) | Plusieurs agents par client, assignation, rôles | Moyen |
| Localisation | UI anglais, devise USD en dur | FR + Arabe (RTL), TND/XOF, formats locaux | Moyen |
| Admin plateforme | Aucun back-office | Console super-admin (clients, suspension, quotas, métriques) | Moyen |
| Conformité Meta | Webhook signé, templates OK | Opt-in/opt-out, politique commerce, qualité numéro | Moyen |
| Code produit (CRM + Automation) | Inbox, contacts, pipelines, broadcasts, automations, flows | — | Acquis |

---

## 4. Plan technique — refonte multi-tenant

### 4.1 Principe directeur

**Base unique partagée + colonne `org_id` partout + RLS par appartenance.**
Pas de schéma-par-client ni base-par-client (ingérable en exploitation pour une
cible PME à fort volume de petits comptes). L'unité de propriété passe de
**l'utilisateur** à **l'organisation**. On conserve les colonnes `user_id`
existantes (« qui a créé / qui est assigné ») mais elles ne pilotent plus la
sécurité.

Décision retenue : **dénormaliser `org_id` sur toutes les tables**, y compris les
dérivées (`messages`…). Coût : le renseigner à l'insertion. Bénéfice : chaque
policy RLS est un test direct O(1) au lieu d'un `EXISTS` imbriqué — décisif sur
`messages`, la table la plus sollicitée.

### 4.2 Inventaire des tables

- **15 tables avec `user_id` direct** à rattacher à une org : `contacts`, `tags`,
  `custom_fields`, `contact_notes`, `conversations`, `message_templates`,
  `pipelines`, `deals`, `broadcasts`, `automations`, `automation_logs`,
  `automation_pending_executions`, `flows`, `flow_runs`, (+ `whatsapp_config`).
- **9 tables dérivées** (org_id via le parent) : `contact_tags`,
  `contact_custom_values`, `messages`, `message_reactions`, `pipeline_stages`,
  `broadcast_recipients`, `automation_steps`, `flow_nodes`, `flow_run_events`.
- **`profiles`** reste lié à `user_id` (identité, pas tenant).

### 4.3 Socle — organisations, membres, invitations

```sql
-- 014_multitenancy_core.sql  (idempotent, même style que les migrations existantes)

CREATE TABLE IF NOT EXISTS organizations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan         TEXT NOT NULL DEFAULT 'trial'
               CHECK (plan IN ('trial','starter','pro','suspended')),
  max_agents   INTEGER NOT NULL DEFAULT 2,
  max_contacts INTEGER NOT NULL DEFAULT 1000,
  currency     TEXT NOT NULL DEFAULT 'TND',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'agent'
             CHECK (role IN ('owner','admin','agent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

CREATE TABLE IF NOT EXISTS org_invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','agent')),
  token       TEXT NOT NULL UNIQUE,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);
```

### 4.4 Fonctions helper RLS (anti-récursion)

Pour éviter la récursion infinie (vérifier l'appartenance lit `org_members`, dont
la RLS relit `org_members`…), on passe par des fonctions `SECURITY DEFINER` qui
contournent la RLS.

```sql
CREATE OR REPLACE FUNCTION public.user_in_org(target UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members WHERE user_id = auth.uid() AND org_id = target
  );
$$;

CREATE OR REPLACE FUNCTION public.user_org_role(target UUID)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM org_members WHERE user_id = auth.uid() AND org_id = target;
$$;

-- Création d'org atomique (org + owner). Indispensable : la policy
-- "admins gèrent les membres" ne laisse pas passer le tout premier insert.
CREATE OR REPLACE FUNCTION public.create_organization(p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO organizations (name, owner_id) VALUES (p_name, auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO org_members (org_id, user_id, role) VALUES (new_id, auth.uid(), 'owner');
  RETURN new_id;
END;
$$;
```

RLS du socle :

```sql
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their org" ON organizations FOR SELECT
  USING (public.user_in_org(id));
CREATE POLICY "Admins update their org" ON organizations FOR UPDATE
  USING (public.user_org_role(id) IN ('owner','admin'));

CREATE POLICY "Members read membership" ON org_members FOR SELECT
  USING (public.user_in_org(org_id));
CREATE POLICY "Admins manage membership" ON org_members FOR ALL
  USING (public.user_org_role(org_id) IN ('owner','admin'))
  WITH CHECK (public.user_org_role(org_id) IN ('owner','admin'));

CREATE POLICY "Admins manage invitations" ON org_invitations FOR ALL
  USING (public.user_org_role(org_id) IN ('owner','admin'))
  WITH CHECK (public.user_org_role(org_id) IN ('owner','admin'));
```

### 4.5 Conversion des tables existantes (patron à répéter)

Triptyque **expand → backfill → verrouiller** sur chaque table tenant. Exemple
`contacts` :

```sql
-- (a) EXPAND : colonne nullable, l'app actuelle continue de tourner
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS org_id UUID
  REFERENCES organizations(id) ON DELETE CASCADE;

-- (b) BACKFILL : rattacher chaque ligne à l'org du user propriétaire
UPDATE contacts c SET org_id = o.id
FROM organizations o WHERE o.owner_id = c.user_id AND c.org_id IS NULL;

-- (c) VERROUILLER + indexer + nouvelle RLS
ALTER TABLE contacts ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);

DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY "Org members manage contacts" ON contacts FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));   -- WITH CHECK : empêche d'écrire dans une autre org
```

Backfill préalable (une seule fois, avant les backfills par table) :

```sql
INSERT INTO organizations (name, owner_id)
SELECT COALESCE(NULLIF(p.full_name,''), p.email, 'Mon espace'), p.user_id
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.owner_id = p.user_id);

INSERT INTO org_members (org_id, user_id, role)
SELECT o.id, o.owner_id, 'owner' FROM organizations o
ON CONFLICT (org_id, user_id) DO NOTHING;
```

Patron pour une dérivée (`messages`, via le parent `conversations`) :

```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS org_id UUID
  REFERENCES organizations(id) ON DELETE CASCADE;
UPDATE messages m SET org_id = c.org_id
FROM conversations c WHERE c.id = m.conversation_id AND m.org_id IS NULL;
ALTER TABLE messages ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id);
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
CREATE POLICY "Org members access messages" ON messages FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));
-- La policy "Service role can insert" reste : le webhook tourne en service_role (bypass RLS).
```

### 4.6 Cas particuliers

- **`whatsapp_config`** : remplacer `UNIQUE(user_id)` par `UNIQUE(org_id)` (un
  numéro par org). Garder `UNIQUE(phone_number_id)` global. Le **webhook** doit
  résoudre `org_id` depuis `phone_number_id`, puis tamponner `org_id` sur les
  `conversations` / `messages` créés.
- **Multi-agents** : `conversations.assigned_agent_id` devient exploitable
  (assigner à un `org_members.user_id`) — argument de vente clé vs le template.
- **Crons** (`/api/automations/cron`, `/api/flows/cron`) : itérer par org.
- **Trigger `handle_new_user`** : ne crée plus d'org automatiquement ; l'org se
  crée à l'onboarding via `create_organization()` ou sur acceptation d'invitation.

### 4.7 Rôles & permissions

| Action | owner | admin | agent |
|---|---|---|---|
| Inbox, contacts, deals, envoi messages | oui | oui | oui |
| Gérer flows / automations / broadcasts | oui | oui | lecture |
| Connecter le numéro WhatsApp, templates | oui | oui | non |
| Inviter / retirer des membres | oui | oui | non |
| Facturation, plan, suppression de l'org | oui | non | non |

Appliqué à deux niveaux : RLS au niveau DB (barrière dure anti-fuite) + gardes
applicatives pour l'UX.

### 4.8 Changements côté application

- **Org active** : un utilisateur peut appartenir à plusieurs orgs → stocker l'org
  courante (cookie httpOnly), helper serveur `getActiveOrgId()`, sélecteur d'org.
- **Lectures** filtrées automatiquement par RLS (aucun `SELECT` à changer).
  **Écritures** : helper d'insertion qui injecte `org_id` systématiquement.
- **Middleware** : si l'utilisateur n'a aucune org → `/onboarding/create-org`.
- **Invitations** : `org_invitations` + e-mail avec token → page d'acceptation.
- Rappel `AGENTS.md` du repo : Next.js 16 a des conventions à part — lire
  `node_modules/next/dist/docs/` avant d'écrire le code des routes/middleware.

### 4.9 Tests d'isolation (non négociable avant le 1er client payant)

Le risque n°1 d'un SaaS multi-tenant est la fuite inter-clients. À automatiser au
CI (Vitest déjà en place) :

```
Étant donné Org A (user a) et Org B (user b) :
  - a crée un contact dans A
  - le client de b fait SELECT * FROM contacts          -> DOIT renvoyer 0 ligne de A
  - b tente INSERT contact avec org_id = A              -> DOIT échouer (WITH CHECK)
  - idem pour conversations, messages, deals, broadcasts, flows…
```

Faire échouer le build si un seul test casse : preuve vivante qu'aucune table
n'a oublié sa policy.

### 4.10 Séquence de déploiement sûre

Pré-lancement (au plus quelques pilotes) : appliquer 014 → 015 → 016 d'un bloc.
Si des données pilotes sont à préserver, faire expand → migrate → contract :
1. **014** : socle + helpers + colonnes `org_id` nullable + backfill + index (l'app continue de tourner).
2. Déployer le code qui écrit `org_id` (double-écriture).
3. **015** : `SET NOT NULL` + bascule de toutes les policies RLS.
4. **016** (optionnel, plus tard) : nettoyages.

---

## 5. Onboarding WhatsApp des clients (chantier critique)

Une PME ne saura jamais récupérer un token chez Meta for Developers. Il faut un
onboarding « quelques clics ». Deux voies :

- **Voie A — Tech Provider Meta + Embedded Signup.** Intégration du flux OAuth
  Meta ; le client autorise et son WABA se connecte seul. Contrôle et marge
  maximaux. Coût : vérification Business Meta, conformité, gestion de la
  facturation des conversations Meta.
- **Voie B — Passer par un BSP** (ex. 360dialog ou équivalent). Le BSP gère
  onboarding et facturation Meta ; on construit le CRM par-dessus.
  Time-to-market plus court, marge partagée, moins de risque réglementaire.

**Recommandation : démarrer en BSP (Voie B)**, internaliser en Tech Provider
(Voie A) uniquement quand le volume le justifie. Cette décision conditionne ~2
mois de travail et la structure de coûts.

---

## 6. Facturation & paiement local

**Stripe n'opère pas en Tunisie** — le réflexe SaaS habituel ne s'applique pas.

- **Local TN** : Konnect, Paymee, Flouci, Clictopay (Monétique Tunisie) — prélèvement en TND.
- **Panafricain** : Paystack / Flutterwave (plusieurs pays francophones).
- **Réalité PME** : prévoir aussi virement / paiement manuel + activation par
  l'admin (beaucoup de PME ne paieront pas par carte récurrente). Le back-office
  super-admin doit permettre activation / suspension manuelle.

C'est autant un sujet produit (compteurs d'usage, plans, quotas, relances) qu'un
sujet d'intégration paiement.

---

## 7. Localisation

- UI multilingue : **français** prioritaire, **arabe (RTL)** fort différenciateur en Tunisie/Maghreb.
- Devises : `deals.currency` aujourd'hui en USD codé en dur → TND / XOF / etc., réglable par org.
- Formats locaux (dates, nombres), templates WhatsApp dans la langue du client.

---

## 8. Marché — PME Tunisie / Afrique francophone

**Signaux positifs**
- WhatsApp est le canal commercial dominant des PME de la région ; beaucoup
  vendent déjà « par WhatsApp » sans CRM, sans suivi, sans broadcast conforme.
- Faible pénétration des CRM occidentaux (chers, en USD, support absent, pas de
  paiement local).
- **Avantage distribution Drwintech** : parc client existant (GED intelligent),
  présence locale, support FR/arabe — exactement ce qui manque aux concurrents
  internationaux.

**Signaux à intégrer**
- Concurrents établis : Wati, Respond.io, 360dialog, intégrateurs locaux. On ne
  gagne pas sur la techno seule.
- Faible willingness-to-pay : prix en monnaie locale, marge comprimée par le coût
  Meta par conversation/message (répercuté).
- Cycle de vente PME = beaucoup d'onboarding/support pour un petit ticket → le
  self-service et la doc FR sont vitaux pour la rentabilité.

**Différenciateurs gagnables** : langue + support local, paiement local, prix en
monnaie locale, mise en service assistée, cross-sell sur les clients GED existants.

---

## 9. Modèle économique & structure de coûts

**Coûts variables à couvrir dans le prix**
- **Meta** : coût par conversation/message (tarification évolutive — à reverrouiller
  au lancement ; bascule Meta vers une logique par message depuis 2025). Poste le
  plus sensible : un « broadcast illimité » à prix fixe peut coûter de l'argent
  sur un gros volume.
- **Infra** : Supabase (par projet/plan) + hébergement Next.js ; surveiller les
  coûts realtime/Postgres à l'échelle.
- **Support** : le vrai coût caché sur la cible PME.

**Tarification suggérée (à tester)** : abonnement mensuel par paliers (nb d'agents
/ contacts / flows) **+ refacturation de l'usage WhatsApp** (pass-through avec
marge), pour ne pas absorber le risque volume. Prévoir un plan d'entrée bas-prix
en TND pour lever la barrière.

---

## 10. Risques & mitigations

| Risque | Gravité | Mitigation |
|---|---|---|
| Dépendance Meta (politique, suspension numéro, changement pricing) | Élevée | Démarrer via BSP ; surveiller la qualité des numéros ; opt-in propre ; ne pas tout miser sur le broadcast |
| Fuite de données inter-clients (RLS mal faite) | Élevée | Tests d'isolation multi-tenant au CI ; revue sécurité dédiée avant le 1er client payant |
| Paiement local (pas de Stripe) | Moyenne | Konnect/Paymee/Flutterwave + fallback virement / activation manuelle |
| Rentabilité PME (ticket bas, support élevé) | Moyenne | Self-service, doc FR, onboarding guidé, automatisation maximale |
| Dépendance au template upstream (auteur tiers, MIT) | Faible | C'est un fork : on en est propriétaire ; figer la version, suivre le CHANGELOG pour les correctifs sécurité |
| Concurrence établie | Moyenne | Jouer le local (langue/paiement/support) + cross-sell base GED |

---

## 11. Roadmap par phases

- **Phase 0 — Valider sans (presque) coder (0–6 semaines).** Vendre le service
  managé : instance wacrm dédiée, brandée, hébergée, à 2–3 clients pilotes
  (idéalement des clients GED). Génère du revenu, valide le pricing, révèle les
  vrais besoins. Le code actuel suffit.
- **Phase 1 — MVP SaaS multi-tenant (≈ 4–5 mois).** Multi-tenance + onboarding via
  BSP + facturation + multi-agents + FR. Lancement self-service auprès des PME.
- **Phase 2 — Scale (≈ 3–4 mois de plus).** Embedded Signup en propre (marge),
  arabe/RTL, back-office avancé, intégrations (dont passerelle GED ↔ WhatsApp,
  vrai différenciateur).

---

## 12. Estimation d'effort (équipe de 2 développeurs)

| Chantier | MVP vendable | Version complète |
|---|---|---|
| Multi-tenance (schéma + RLS + tests d'isolation) | 4–5 sem | 5–6 sem |
| Onboarding WhatsApp (via BSP) | 2–3 sem | 4 sem (+ Embedded Signup) |
| Multi-agents / rôles | 2 sem | 3–4 sem |
| Facturation + paiement local + quotas | 3–4 sem | 6 sem |
| Back-office super-admin | 2 sem | 3 sem |
| Localisation FR/AR (+RTL) + devises | 2 sem | 3–4 sem |
| Onboarding self-service, e-mails, docs | 2 sem | 3 sem |
| **Total** | **≈ 4–5 mois** | **≈ 7–9 mois** |

Le template divise par ~2 ce qu'aurait coûté un produit from-scratch.

---

## 13. Recommandation finale

**Y aller — mais en commençant par vendre, pas par coder.** Le risque n°1 n'est
pas technique (le template est solide) mais **commercial et réglementaire** :
capacité à onboarder l'API WhatsApp simplement, à encaisser localement, et à
servir une cible PME à faible ticket de façon rentable. La Phase 0 (service
managé sur les clients GED) lève ces incertitudes pour un coût quasi nul avant
d'engager les ~4–5 mois de la version SaaS.

Le levier décisif que personne d'autre n'a sur ce marché : base client locale +
support FR/arabe + paiement local + pont avec GED intelligent.

---

## Annexe — Prochaines étapes actionnables

1. Décision **BSP vs Tech Provider** (comparatif chiffré à produire).
2. Choix du **prestataire de paiement** local.
3. Sélection de **2–3 clients pilotes** pour la Phase 0.
4. Génération des **migrations `014/015`** (socle multi-tenant) — prêtes à coder.
5. Définition du **modèle de pricing en TND** (paliers + structure de coûts Meta/Supabase).
