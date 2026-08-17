# Transport pilote Baileys (WhatsApp Web) — usage interne

> Document interne Drwintech — Dernière mise à jour : 2026-08-17
>
> **Décision cadre : usage pilote / interne uniquement.** Ce transport
> n'est ni vendu, ni proposé, ni mentionné à un client. La seule voie
> client-facing reste l'API Meta Cloud.

---

## 1. Pourquoi ce composant existe

L'étude de faisabilité (`etude-faisabilite-wacrm-saas.md`, §5) identifie
l'onboarding WhatsApp comme le goulot critique : une PME ne récupérera
jamais seule un token chez Meta, et l'alternative — passer par un BSP —
suppose un contrat, une vérification Business et une marge partagée.

Tant que cette décision n'est pas prise, toute démo et tout test
bout-en-bout exigent un WABA. C'est ce blocage-là, et seulement
celui-là, que le pilote lève :

- **Démo commerciale** — montrer le produit vivant sur un vrai numéro,
  sans provisionner quoi que ce soit chez Meta.
- **Test bout-en-bout** — exercer inbox, automations, flows et agent IA
  contre un vrai handset, en CI manuelle ou en recette.
- **Banc d'essai** — valider un flow avant de le rejouer sur un WABA.

Ce n'est **pas** un produit, **pas** une offre d'entrée de gamme, et
**pas** un plan B commercial.

---

## 2. Pourquoi il n'est pas vendable

| Risque | Conséquence |
|---|---|
| Violation des CGU WhatsApp | Baileys est un client non officiel rétro-ingéniéré. La licence MIT protège le projet, pas nous. |
| Bannissement du numéro | Le numéro banni est **celui du client** — son numéro commercial principal. Perte sèche, immédiate, irréversible. |
| Aucun engagement de service | Pas de SLA, pas de support, pas de recours. Le protocole peut changer sans préavis. |
| Exposition contractuelle | Vendre ça sous contrat B2B engage Drwintech sur un service qu'un tiers peut couper à tout moment. |

Le broadcast — envoi en masse — est précisément le comportement qui
déclenche les bannissements. Il est donc **refusé côté code** sur ce
transport (`/api/whatsapp/broadcast` répond 400).

---

## 3. Garde-fous en place

La règle « pilote uniquement » n'est pas qu'une note dans un document :
elle est tenue par le code et l'infrastructure.

1. **Pas d'UI.** Aucun écran d'appairage. Le seul point d'entrée est
   `/api/admin/whatsapp-pilot/[orgId]`, réservé aux `super_admin`
   (`profiles.role`, migration 019). Un client ne peut pas l'activer.
2. **Désactivé par défaut.** Sans `WA_GATEWAY_URL` / `WA_GATEWAY_TOKEN`,
   la route répond 503 et le webhook rejette toute charge signée par le
   gateway.
3. **Hors profil Docker par défaut.** Le service ne démarre qu'avec
   `docker compose --profile pilot up`. Un `up` normal ne le lance pas.
4. **Cloisonnement des transports.** Le webhook refuse une charge signée
   Meta qui viserait une org `baileys`, et l'inverse. Un gateway
   compromis ne peut donc pas injecter dans une org de production.
5. **Pas de reprise d'une org Meta.** La route d'appairage répond 409 si
   l'org est déjà configurée en Meta Cloud API.
6. **Broadcasts refusés.** Voir §2.
7. **Templates refusés.** Ils n'existent pas hors API officielle ; le
   provider lève une erreur explicite plutôt que d'envoyer n'importe quoi.

---

## 4. Architecture

```
                     ┌───────────────────────────┐
   handset  ◀──WS──▶ │  wa-gateway (side-car)    │
                     │  1 socket Baileys / org   │
                     │  creds Signal sur volume  │
                     └────┬──────────────────▲───┘
             webhook Meta │                  │ HTTP + Bearer
             signé HMAC   │                  │ (envois, média)
                          ▼                  │
                     ┌───────────────────────┴───┐
                     │  app (Next.js)            │
                     │  /api/whatsapp/webhook    │
                     │  providerFromConfig()     │
                     └───────────────────────────┘
```

**Le point clé** : le gateway ré-émet les événements Baileys **au format
webhook Meta**. Inbox, contacts, automations, flows, agent IA et
dashboard ne savent pas qu'un second transport existe — aucun de ces
modules n'a été modifié.

Côté app, tous les envois passent par `src/lib/whatsapp/provider.ts`, qui
résout le transport depuis `whatsapp_config.provider`. Cette façade est
utile indépendamment du pilote : c'est aussi ce sur quoi se branchera un
BSP ou l'Embedded Signup, sans re-balayer les neuf fichiers appelants.

### Fichiers

| Chemin | Rôle |
|---|---|
| `src/lib/whatsapp/provider.ts` | Façade + choix du transport |
| `src/lib/whatsapp/baileys-gateway.ts` | Client HTTP du side-car |
| `src/lib/whatsapp/gateway-signature.ts` | HMAC partagé avec le side-car |
| `src/app/api/admin/whatsapp-pilot/[orgId]/route.ts` | Appairage (super-admin) |
| `services/wa-gateway/` | Le side-car Node (projet npm autonome) |
| `supabase/migrations/020_whatsapp_provider_pilot.sql` | Colonne `provider` + état de session |

---

## 5. Limites fonctionnelles connues

À énoncer avant toute démo, pour ne pas promettre ce que le pilote ne
tient pas :

- **Broadcasts : indisponibles.** Refusés côté code (§2).
- **Templates : indisponibles.** Objet propre à l'API Cloud.
- **Boutons et listes : rendus en menu texte numéroté.** WhatsApp
  restreint progressivement les messages interactifs à l'API officielle ;
  une bulle vide chez le client, c'est un flow mort. Le gateway envoie
  donc `1. Tarifs / 2. Support`, et **remappe la réponse vers l'id
  d'option attendu** par le moteur Flows. Le runner ne voit pas la
  différence. `WA_INTERACTIVE_MODE=native` bascule sur les vraies bulles,
  au risque qu'elles ne s'affichent pas.
- **Réactions : seulement sur les messages échangés depuis l'appairage.**
  WhatsApp Web adresse un message par clé complète ; le gateway n'indexe
  que ce qu'il a vu (2 000 derniers messages).
- **Citations : aperçu du message cité parfois vide.** Cosmétique.
- **Groupes : ignorés.** Le modèle de données du CRM est 1 contact = 1
  conversation.
- **Média : téléchargé à la réception, pas à la demande.** Les clés de
  déchiffrement sont à usage unique — un média non récupéré à l'arrivée
  est définitivement perdu. Il est mis en cache sur le volume.
- **Une instance, pas de réplication.** Le socket est unique par org.

---

## 6. Mise en route

### 6.1 Variables

```bash
# À générer : openssl rand -hex 32 (une valeur différente pour chacune)
WA_GATEWAY_TOKEN=...     # bearer app → gateway
WA_GATEWAY_SECRET=...    # HMAC gateway → app, DOIT différer de META_APP_SECRET
WA_GATEWAY_URL=http://wa-gateway:4100
```

`WA_GATEWAY_SECRET` doit être identique des deux côtés et **distinct** de
`META_APP_SECRET` : c'est ce qui garantit qu'un gateway compromis ne peut
pas contrefaire du trafic Meta.

### 6.2 Migration

Appliquer `supabase/migrations/020_whatsapp_provider_pilot.sql`. Elle est
idempotente et ne change aucun comportement à elle seule : la colonne
`provider` vaut `'meta'` par défaut, donc toutes les orgs existantes
restent exactement où elles sont.

### 6.3 Démarrage

```bash
docker compose --profile pilot up -d wa-gateway
docker compose logs -f wa-gateway
```

### 6.4 Appairage d'une org

```bash
# 1. Démarrer la session — renvoie un QR en data URL
curl -X POST https://<crm>/api/admin/whatsapp-pilot/<ORG_ID> \
     -H 'Cookie: <session super-admin>'

# Variante code d'appairage (sans caméra) : numéro en E.164 sans '+'
curl -X POST https://<crm>/api/admin/whatsapp-pilot/<ORG_ID> \
     -H 'Content-Type: application/json' \
     -d '{"phoneNumber":"21612345678"}'

# 2. Scanner le QR (WhatsApp → Appareils connectés) ou saisir le code
# 3. Vérifier
curl https://<crm>/api/admin/whatsapp-pilot/<ORG_ID>
# → {"state":"connected","phoneNumber":"21612345678",...}

# 4. Dépairer et nettoyer
curl -X DELETE https://<crm>/api/admin/whatsapp-pilot/<ORG_ID>
```

Le `DELETE` déconnecte côté WhatsApp, supprime les credentials, l'état et
le cache média, puis efface la ligne `whatsapp_config`.

---

## 7. Exploitation

- **Volume `wa-gateway-data`** — contient les credentials Signal. Le
  perdre dépaire toutes les sessions ; le copier ailleurs clone
  l'identité WhatsApp. À traiter comme un secret.
- **`state: logged_out`** — WhatsApp a invalidé la session (dépairage
  depuis le téléphone, ou bannissement). Le gateway **ne se reconnecte
  pas** : boucler sur des credentials mortes est ce qui aggrave un
  bannissement. Ré-appairer manuellement.
- **Reconnexion** — backoff 1s → 60s sur toute autre coupure. Les
  sessions sont rouvertes automatiquement au redémarrage du conteneur.
- **Image Debian slim, pas Alpine** — `whatsapp-rust-bridge` (dépendance
  native de Baileys 7) est lié à la glibc. Sur musl il casse au premier
  handshake, ce qui ressemble à un problème WhatsApp alors que c'est un
  problème de libc.

---

## 8. Quand rouvrir la question

La décision « pilote uniquement » est réversible, mais elle ne se rouvre
que sur un fait nouveau :

- la voie BSP s'enlise ou devient économiquement intenable ;
- **et** un cadre contractuel assumant explicitement le risque de
  bannissement est prêt ;
- **et** les limites du §5 sont acceptables pour le segment visé.

Tant que ces trois conditions ne sont pas réunies, le chemin critique
reste celui de l'étude : trancher **BSP vs Tech Provider**, et brancher
l'encaissement local.
