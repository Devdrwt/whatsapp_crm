# Drwintech — Guide d'utilisation

> CRM et automatisation WhatsApp pour PME. Ce guide couvre l'usage
> quotidien : inbox, contacts, pipelines, broadcasts, automations,
> flows, agent IA et réglages.

---

## Sommaire

1. [À propos](#à-propos)
2. [Premiers pas](#premiers-pas)
3. [Tableau de bord](#tableau-de-bord)
4. [Inbox — la conversation au centre](#inbox--la-conversation-au-centre)
5. [Contacts](#contacts)
6. [Pipelines & deals](#pipelines--deals)
7. [Broadcasts (campagnes)](#broadcasts-campagnes)
8. [Automations](#automations)
9. [Flows (chatbot à boutons)](#flows-chatbot-à-boutons)
10. [Agent IA](#agent-ia)
11. [Réglages](#réglages)
12. [Bonnes pratiques WhatsApp](#bonnes-pratiques-whatsapp)
13. [Dépannage](#dépannage)
14. [FAQ](#faq)
15. [Guide de recette — comment tester](#guide-de-recette--comment-tester)

---

## À propos

Drwintech regroupe **tout ce qu'une PME utilise WhatsApp pour faire**
dans une seule interface :

- une **inbox partagée** entre les agents, sur le numéro WhatsApp Business officiel ;
- une base **contacts** avec tags, champs personnalisés, import CSV ;
- des **pipelines de vente** (Kanban) avec des deals reliés aux conversations ;
- des **broadcasts** (campagnes WhatsApp) sur des templates approuvés par Meta ;
- deux moteurs d'automatisation complémentaires : **Automations** (règles)
  et **Flows** (chatbot à boutons), plus un **Agent IA** qui répond en
  langage naturel quand rien ne matche.

Tout est **multi-thème (clair / sombre / système)** — bouton soleil/lune
en haut à droite.

---

## Premiers pas

### Créer le compte
1. Ouvre l'application (URL fournie par ton équipe ou ton instance).
2. Page **Login** : si tu n'as pas encore de compte, clique
   *Create account* et remplis nom, email, mot de passe. Sinon connecte-toi.

### Connecter ton numéro WhatsApp Business
1. Va dans **Settings → WhatsApp Config**.
2. Renseigne :
   - **Phone Number ID** (récupéré dans Meta for Developers → WhatsApp → API Setup)
   - **WABA ID** (WhatsApp Business Account ID — même endroit)
   - **Access Token** (token permanent généré côté Meta)
3. **Save & verify**. L'app appelle Meta pour confirmer que le token est valide
   et que le numéro est bien rattaché. Le statut passe à **Connected**.
4. Côté Meta, configure l'URL du **webhook** : `https://<ton-domaine>/api/whatsapp/webhook`,
   et la **clé de vérification** affichée dans Settings → WhatsApp Config.

> Une fois connecté, tout message envoyé à ton numéro WhatsApp arrive
> automatiquement dans **Inbox**.

### Synchroniser les templates Meta
Dans **Settings → Templates**, clique **Sync from Meta**. Tu récupères
tous les templates approuvés par Meta sur ton compte (utilisés pour les
broadcasts et certaines réponses automatiques).

---

## Tableau de bord

L'écran d'accueil après connexion. Vue d'ensemble live de l'activité.

- **Cartes métriques** (en haut) : conversations actives, nouveaux
  contacts du jour, valeur des deals ouverts, messages envoyés du jour.
  Le delta vs hier est indiqué (vert = montée, rouge = baisse).
- **Quick Actions** : raccourcis pour créer un contact, un deal, un
  broadcast ou une automation.
- **Conversations Over Time** : volume de messages entrants/sortants
  par jour, sur 7 / 30 / 90 jours.
- **Pipeline Value** : donut des deals ouverts par étape.
- **Average First Response Time** : temps moyen pour répondre à un
  premier message client, par jour de la semaine. Une ligne pointillée
  marque ton objectif (5 min par défaut).
- **Recent Activity** : flux unifié — messages, contacts, deals,
  broadcasts, automations, dans l'ordre chronologique inverse.

---

## Inbox — la conversation au centre

L'inbox est la pièce maîtresse. Trois colonnes : **liste de conversations**,
**fil de messages**, **fiche contact**.

### Conversations
- **Statut** : `Open` (en cours), `Pending` (en attente d'un humain — souvent
  posé par un flow ou un handoff), `Closed` (terminée).
- **Assignation** : assigner une conversation à un agent de l'équipe
  (depuis la fiche contact à droite). Utile en multi-agents.
- **Non lus** : pastille de comptage et point clignotant dans la sidebar
  lorsque tu as des messages non lus.

### Envoyer un message
- Tape ton texte dans le composer en bas.
- **Pièce jointe** : icône trombone (image, document, audio, vidéo).
- **Template** : pour envoyer un template Meta approuvé (obligatoire
  après 24 h de silence du client — voir [Bonnes pratiques](#bonnes-pratiques-whatsapp)).
- **Réponse à un message précis** : clique l'icône "Reply" sur le message
  cible — il s'affichera cité au-dessus de ta réponse, comme dans WhatsApp.
- **Réactions** : pose un emoji en réaction à un message comme sur WhatsApp.

### Fiche contact
À droite : nom, téléphone, email, société, tags, champs personnalisés,
notes, deals associés. Tout est éditable en place. Les notes sont privées
(visibles uniquement par tes agents).

---

## Contacts

Toute personne qui a écrit (ou qu'on a importée). Page **Contacts**.

### Créer / modifier
- Bouton **New Contact** : nom + téléphone (E.164 : `+216...`).
- L'app **dédoublonne automatiquement** sur le téléphone normalisé.

### Tags
Catégorise tes contacts (ex. *VIP*, *Lead chaud*, *À rappeler*).
Crée et nomme tes tags dans **Settings → Tags**.

### Champs personnalisés
Crée tes propres champs (ex. *date d'anniversaire*, *référence client*,
*région*) dans **Settings → Templates → Custom Fields** — ils s'affichent
dans chaque fiche contact.

### Import CSV
Bouton **Import** : un assistant mappe les colonnes du CSV (nom,
téléphone, email, tags, champs personnalisés). Les doublons sur le
téléphone sont fusionnés, pas dupliqués.

---

## Pipelines & deals

Pour le suivi commercial.

### Pipelines
Un **pipeline** = une série d'**étapes** (ex. *Lead → Contacté → Devis envoyé
→ Gagné / Perdu*). Tu peux avoir plusieurs pipelines en parallèle (ex.
ventes B2B, abonnements, SAV).

Crée / édite dans **Pipelines → Settings**. Chaque étape a une couleur
qui se propage aux deals, au donut du dashboard et aux analytics.

### Deals
Une **affaire** rattachée à un contact, et éventuellement à une
conversation. Champs : titre, montant, devise, date de clôture prévue,
notes.

- **Drag & drop** entre étapes sur le board Kanban.
- **Analytics** : valeur du pipeline, valeur par étape, taux de
  conversion, temps moyen par étape.
- Les deals *Won* / *Lost* sortent du pipeline ouvert et remontent dans
  les rapports historiques.

---

## Broadcasts (campagnes)

Envoi de messages à plusieurs contacts à la fois, sur un **template Meta
approuvé**. Assistant en **4 étapes** depuis **Broadcasts → New Broadcast** :

### 1. Choisir le template
Liste de tes templates approuvés (synchronisés depuis Meta). Aperçu
visuel sur la droite.

### 2. Sélectionner l'audience
Filtre par **tags**, **étape de pipeline**, **dates** (créés après X,
inactifs depuis Y), **champs personnalisés**, etc. Compteur live de
destinataires.

### 3. Personnaliser
Si ton template contient des **variables** (`{{1}}`, `{{2}}`...), tu
mappes chacune à un champ contact (`{{name}}`, un champ personnalisé,
une valeur fixe).

### 4. Planifier
- **Envoyer maintenant** : démarrage immédiat.
- **Programmer** : date + heure.

### Pendant et après l'envoi
Sur la page du broadcast :
- Compteurs en temps réel : **envoyés / livrés / lus / répondus / échoués**.
- Entonnoir visuel (livraison, lecture, réponse).
- Liste détaillée des destinataires : statut individuel + erreur Meta
  s'il y en a une.
- **Pulse** : un statut *Sending* clignote pendant l'envoi.

> **Important** : les broadcasts utilisent des templates approuvés *uniquement* —
> tu ne peux pas envoyer du texte libre à un contact qui ne t'a pas
> écrit dans les 24 h. C'est une règle Meta, pas une limite Drwintech.

---

## Automations

Réponses **règle-based** : "quand X arrive, fais Y, sinon Z". Visuel
mais déterministe (pas d'IA). Idéal pour des routines stables.

### Déclencheurs
- **New Message Received** : un client a écrit (n'importe quoi).
- **First Message from Contact** : son tout premier message.
- **Keyword Match** : un mot-clé précis dans le message.
- **New Contact** : un contact vient d'être créé.
- **Conversation Assigned** : une conversation a été assignée.
- **Tag Added** : un tag vient d'être posé sur un contact.
- **Time-Based** : à une heure / fréquence donnée.

### Étapes (actions)
- **Send Message** : envoyer un texte ou un template.
- **Add / Remove Tag** : tagger ou détagger un contact.
- **Webhook** : appeler un endpoint externe (intégration ERP, CRM, etc.).
- **Wait** : attendre N minutes / heures / jours avant la suite (drainé
  par un cron toutes les minutes).
- **Branche conditionnelle** : si telle condition (mot-clé, tag, champ,
  heure)…
- **Stop** : terminer l'exécution.

### Création
**Automations → New Automation** :
1. Choisis un déclencheur.
2. Configure les conditions / paramètres.
3. Ajoute les étapes (drag & drop dans le builder).
4. **Active** l'automation avec le switch en haut.

### Suivi
**Automations → [nom] → Logs** : chaque exécution (réussie / en attente
/ en erreur), avec le contexte et le contact concernés.

---

## Flows (chatbot à boutons)

Conversations **guidées** par des boutons et listes WhatsApp. Idéal pour
faire patienter / qualifier un lead en libre-service, ou pour un menu
"Tapez 1 pour X, 2 pour Y" enrichi.

### Nœuds disponibles
- **Send Message** : envoyer un texte simple.
- **Send Buttons** : poser une question avec jusqu'à 3 boutons cliquables.
- **Send List** : menu déroulant (au-delà de 3 options).
- **Collect Input** : capturer une réponse texte (email, code postal,
  message libre) et la stocker dans une variable `{{vars.X}}`.
- **Condition** : aiguillage selon un tag, une valeur capturée, l'heure, etc.
- **Set Tag** : tagger le contact à partir d'une réponse.
- **Interpolation `{{vars.X}}`** : réinjecter dans un message suivant
  ce que le contact a tapé.

### Démarrer un flow
- **Déclencheur** : mot-clé, premier message, après un délai, ou
  manuellement depuis la fiche contact.
- **Idempotence** : si Meta livre deux fois le même message (ça arrive),
  le flow ne s'avance qu'une fois.

### Fallback (si le client tape autre chose qu'un bouton)
Configurable sur chaque flow :
- **reprompt** : reposer la question, jusqu'à N fois.
- **handoff** : passer la conversation à un humain (statut *Pending*).
- **end** / **ignore** : terminer ou ne rien faire.
- **timeout** : si le client ne répond pas pendant X heures.

### Templates prêts à l'emploi
**Flows → New from template** : *Welcome menu*, *FAQ bot*, *Lead capture*
— à personnaliser.

### Suivi
**Flows → [nom] → Runs** : chaque exécution avec son chemin nœud par
nœud et les variables capturées.

---

## Agent IA

Quand ni un flow ni une automation ne traite un message texte, l'**Agent IA**
peut répondre **en langage naturel** à partir de la **base de connaissance**
que tu lui fournis. Idéal pour la FAQ ouverte qui ne tient pas dans un menu
à boutons.

### Activation
**Settings → AI Agent** :
- **Enable AI agent** : switch ON/OFF.
- **Agent name** : nom affiché côté client (ex. *Sofia*).
- **Model** : *Sonnet 4.6* (meilleure qualité) ou *Haiku 4.5* (plus rapide
  et économique).
- **Persona & tone** : ton et style (ex. *Amicale, concise, propose toujours
  de rappeler*).
- **Knowledge base** : colle ici **tout** ce que l'agent peut connaître —
  menu, prix, horaires, FAQ, politiques de retour. **L'agent ne sait que ce
  que tu lui dis ici**, il n'invente rien.
- **Fallback message** : phrase exacte que l'agent dit quand il ne sait
  pas (ex. *« Je transmets votre demande à un conseiller. »*). À ce
  moment, la conversation peut basculer humain.

### Quand il déclenche
- Le message est un **texte** (pas un bouton, pas une image seule).
- Aucun **flow** actif n'attend de réponse pour ce contact.
- Aucune **automation** keyword/new_message n'a déjà répondu.

> En clair : l'agent IA est le **dernier filet** avant le silence ou le
> handoff. Tes flows et automations restent prioritaires.

### Bonnes pratiques pour la base de connaissance
- Une info = une ligne courte et claire (le LLM comprend mieux les
  listes que les paragraphes denses).
- Mets l'**unité** et la **devise** sur les prix (`25 TND`).
- Précise les **horaires** complets (`Lun-Ven 9h-18h, Sam 9h-13h, fermé Dim`).
- Pour les FAQ, formule en Q/R : `Q: livraison ? R: 24-48 h en Tunisie, 50 TND.`.

---

## Réglages

**Settings**, accessible via le menu utilisateur ou la sidebar.

- **Profile** : nom, email, avatar, mot de passe, sessions actives (déconnexion globale).
- **WhatsApp Config** : voir [Premiers pas](#premiers-pas).
- **Templates** : tes templates Meta synchronisés.
- **Tags** : créer / renommer / supprimer les tags.
- **AI Agent** : voir [Agent IA](#agent-ia).
- **Appearance** : Clair / Sombre / Système — appliqué instantanément,
  sauvegardé sur l'appareil.

---

## Bonnes pratiques WhatsApp

### La règle des 24 h (Meta)
Tu ne peux envoyer du **texte libre** à un contact que **pendant les 24 h
qui suivent son dernier message**. Passé ce délai, **uniquement des
templates approuvés**. Ça vaut pour les agents humains, les automations
et les broadcasts.

### Opt-in
Tes contacts doivent **avoir consenti** à recevoir des messages. Tu dois
pouvoir prouver ce consentement (case cochée sur un site, "Tape OUI",
formulaire signé, etc.). Meta peut suspendre un numéro qui spam.

### Qualité du numéro
Meta attribue un **rating** à ton numéro (vert/jaune/rouge). Plus tu as
de réponses positives et peu de blocages/signalements, mieux tu te
portes. Évite les broadcasts trop fréquents, segmente bien tes
audiences.

### Templates : catégories
- **Marketing** : promo, nouveautés (le plus surveillé par Meta).
- **Utility** : confirmations, notifications, reçus.
- **Authentication** : codes OTP.

Choisis la bonne catégorie au moment de créer le template — Meta le rejette si
ça ne correspond pas.

### Multilingue
Crée une **version par langue** de chaque template (FR, AR, EN). Au moment
de l'envoi, l'app choisit la bonne langue selon la préférence ou un
champ contact.

---

## Dépannage

### Je n'arrive pas à me connecter
- Vérifie l'URL et que tu utilises le bon email.
- Mot de passe oublié → page **Forgot password** → un email te sera envoyé
  (configure-toi un fournisseur SMTP côté Supabase si ce n'est pas fait).
- Compte créé mais bloqué sur "Check your email" : en dev, demande à
  ton admin de désactiver la confirmation email dans Supabase, ou de
  confirmer ton compte manuellement.

### Les messages WhatsApp n'arrivent pas dans Inbox
- **Settings → WhatsApp Config** doit afficher **Connected**.
- L'URL du webhook côté Meta doit pointer sur `https://<ton-domaine>/api/whatsapp/webhook`.
- La clé de vérification côté Meta doit correspondre à celle affichée
  dans Settings.
- Vérifie le **rating** du numéro côté Meta : un numéro suspendu ne
  reçoit plus rien.

### Un broadcast bloque à "Sending"
- Regarde la liste des destinataires : si certains sont en **failed**,
  l'erreur Meta est affichée à droite (souvent : numéro invalide, opt-out,
  template non approuvé pour ce destinataire).
- Si **tous** sont *failed* : le template n'est pas approuvé, ou l'access
  token a expiré. Re-vérifie WhatsApp Config.

### L'agent IA ne répond pas
- Vérifie que **Enable AI agent** est ON dans Settings.
- Vérifie que le message du client est **du texte** (pas une image,
  pas un bouton).
- Vérifie qu'**aucun flow** n'est en attente pour ce contact (un flow
  actif prend la priorité — par design).
- Si un mot-clé d'automation a matché, c'est l'automation qui a répondu
  (l'IA reste silencieuse pour éviter la double réponse).

### Une automation ne se déclenche pas
- L'automation est-elle **active** ? (Switch en haut de la page de l'automation.)
- Si déclencheur `keyword_match` : le mot-clé est-il bien orthographié,
  insensible à la casse ?
- Si tu as un **flow actif** sur le même contact, les triggers
  *new_message_received* et *keyword_match* sont volontairement
  suspendus — sinon flow et automation se marcheraient dessus.
- Va dans **Automations → [nom] → Logs** : tu verras pourquoi un
  déclenchement a été ignoré (condition pas matchée, étape en attente, etc.).

### Le mode clair / sombre ne change pas
La bascule est dans le **header** (icône soleil / lune, en haut à
droite). Le choix s'enregistre sur cet appareil. Pour repartir sur le
choix de l'OS, va dans **Settings → Appearance → System**.

---

## FAQ

### Compte & organisation

**Combien d'utilisateurs puis-je avoir dans mon organisation ?**
Pas de limite technique imposée. Le plan **trial** par défaut comporte
2 agents max (configurable côté Drwintech). Au-delà, on bascule sur
*starter* / *pro*.

**Puis-je appartenir à plusieurs organisations ?**
Oui. Tu vois ton org active dans le sélecteur en haut du header
(icône immeuble + nom). Clique pour switcher ou en créer une autre.
Chaque org a ses contacts, conversations, deals, etc. — strictement
isolés.

**L'invitation que j'ai envoyée a expiré. Que faire ?**
Les invitations sont valides **7 jours**. Va dans Settings → Team
→ révoque l'ancienne et recrée-en une nouvelle. Le destinataire
reçoit une nouvelle URL.

**J'essaie d'accepter une invitation et l'app me dit *email mismatch*.**
L'invitation a été envoyée à `marie@…` et tu es connecté en
`pierre@…`. Déconnecte-toi (lien dans le message d'erreur) et
reconnecte-toi avec l'email exact de l'invitation, OU demande au
propriétaire de t'envoyer une nouvelle invitation à ton vrai email.

**Comment retirer un membre ?**
Settings → Team → menu `…` à côté du membre → *Remove from
organization*. Le propriétaire (owner) ne peut pas être retiré et ne
peut pas se retirer lui-même.

### WhatsApp

**Mon broadcast est *failed* sur certains destinataires.**
Clique sur le broadcast pour voir la cause par destinataire :
typiquement *numéro invalide*, *opt-out client* (le contact a fait
"stop"), ou *template non approuvé pour cette langue*. Tu peux
relancer après correction (créer un nouveau broadcast filtré sur les
contacts à recibler).

**Pourquoi je ne peux pas envoyer de texte libre à un client qui ne
m'a pas répondu depuis longtemps ?**
Règle Meta : passé **24 h** sans message du client, tu ne peux que
lui envoyer un **template approuvé**. C'est une restriction côté Meta,
pas Drwintech. Utilise un template *Utility* ou *Marketing*.

**Mon numéro WhatsApp est suspendu / a un mauvais rating.**
Va sur [business.facebook.com](https://business.facebook.com) → WhatsApp Manager → *Quality rating*.
Trop de signalements de spam ou de blocages déclenchent la suspension.
Pour réhabiliter : segmenter mieux tes audiences, espacer les
broadcasts, demander un *opt-in* propre, répondre vite aux questions
entrantes.

**Comment importer mes contacts existants ?**
Contacts → bouton **Import** → uploader un CSV. L'assistant te laisse
mapper chaque colonne (nom, téléphone, email, tags, champs
personnalisés). Les doublons sur le téléphone sont **fusionnés**, pas
dupliqués.

### Broadcasts, automations, flows

**Différence entre *Automation* et *Flow* ?**
- **Automation** : règle « quand X arrive, fais Y ». Linéaire ou avec
  branches conditionnelles, sans interaction client (l'agent peut
  envoyer un message, taguer, attendre, appeler un webhook).
- **Flow** : conversation guidée par **boutons / listes** que le
  client tape. Idéal pour menus, qualification, capture d'info en
  libre-service.

Si un même client peut déclencher les deux, le **flow gagne** :
l'automation `new_message` est suspendue pour éviter la double
réponse.

**Mon flow ne démarre pas sur le mot-clé que j'ai défini.**
- Le flow est-il **actif** (status `active`, pas `draft`) ?
- Le mot-clé est-il bien orthographié dans `trigger_config` ? La
  comparaison est insensible à la casse.
- Le client est-il déjà dans un autre flow actif ? Un contact ne peut
  avoir qu'**un run actif à la fois** (par org).

**Le client a tapé autre chose qu'un bouton — que se passe-t-il ?**
Selon le `fallback_policy` du flow : *reprompt* (re-propose la
question, jusqu'à N fois), *handoff* (bascule humain — statut
*Pending* dans l'inbox), *end* (termine), ou *ignore* (rien). Par
défaut : reprompt × 2 puis handoff.

### Agent IA

**L'agent IA est-il facturé ?**
À l'usage côté Anthropic (modèle Sonnet ou Haiku). Tarifs très bas
côté Haiku (~$1 / million de tokens input). Pour une PME avec 50
conversations IA / jour, compter quelques dollars par mois. **Côté
Drwintech, on facture l'IA en pass-through** (le coût Anthropic est
répercuté avec une faible marge).

**L'agent IA donne une réponse incorrecte.**
Va dans Settings → AI Agent et **édite la base de connaissance** : si
l'info n'y est pas, l'agent ne la connaît pas (il n'invente jamais).
Si l'info y est mais l'agent la formule mal, ajuste la **persona**
("toujours répondre par une phrase courte", "ne jamais promettre une
date").

**L'agent IA répond *« Je transmets votre demande à un conseiller »*
trop souvent.**
C'est le **fallback message** : il s'active quand l'agent ne trouve
PAS l'info dans la base. Étoffe la base de connaissance (FAQ,
catalogue produit, prix, horaires) pour réduire ces cas.

**Comment basculer manuellement une conversation IA → humain ?**
Dans l'inbox, change le statut de la conversation de *Open* à
*Pending*, ou assigne-la à un agent humain. Le flow / l'automation
respecte le statut et l'agent IA reste silencieux tant que la
conversation est sous responsabilité humaine.

### Données

**Mes données sont-elles sauvegardées ?**
Oui, côté Supabase (PostgreSQL avec PITR — Point-in-Time Recovery —
selon le plan choisi par Drwintech). Une org peut être **exportée à
la demande** (sujet à venir : bouton *Export GDPR* dans Settings).

**Je supprime un contact — que devient l'historique ?**
La conversation et les broadcasts envoyés à ce contact **survivent**
avec le `contact_id = NULL` (ils s'affichent comme *Contact supprimé*).
Pas de perte d'audit ni de comptes broadcast.

**Multi-langue ?**
L'interface est en anglais pour l'instant (français côté guide et
documentation). Sur les templates WhatsApp, chaque langue est un
**template séparé** côté Meta, à approuver indépendamment.

---

## Guide de recette — comment tester

> Liste de scénarios à passer avant de mettre en production un nouveau
> client, après une livraison de fonctionnalité, ou comme **smoke test
> hebdomadaire**. Chaque scénario : **Setup → Action → Attendu**.
> Coche quand c'est vert.

### 1. Compte & onboarding

**1.1 Inscription**
- **Setup** : nouveau compte Supabase Auth (`test@drwintech.com`).
- **Action** : ouvrir l'app → tu es redirigé sur `/login` → créer un
  compte via `/signup`.
- **Attendu** : tu atterris sur `/onboarding/create-org`, tu crées
  une org, tu arrives sur `/dashboard`.

**1.2 Connexion existante**
- **Setup** : un user avec une org déjà.
- **Action** : login.
- **Attendu** : direct sur `/dashboard`, sélecteur d'org en haut.

**1.3 Switch d'org**
- **Setup** : un user qui appartient à 2 orgs.
- **Action** : cliquer le sélecteur d'org → choisir l'autre.
- **Attendu** : page se rafraîchit, les données changent
  (contacts/tags/deals de la nouvelle org), aucune fuite de l'org
  précédente.

### 2. Connexion WhatsApp

**2.1 Première connexion d'un numéro**
- **Setup** : un compte Meta Business avec WABA + numéro vérifié.
- **Action** : Settings → WhatsApp Config → coller Phone Number ID,
  WABA ID, Access Token → **Save & verify**.
- **Attendu** : statut passe à **Connected**, sync des templates Meta
  pour qu'ils apparaissent dans Templates.

**2.2 Webhook entrant**
- **Setup** : webhook configuré côté Meta sur `https://<domaine>/api/whatsapp/webhook`.
- **Action** : envoyer un message WhatsApp à ton numéro depuis un
  téléphone perso.
- **Attendu** : la conversation apparaît dans Inbox en quelques
  secondes ; le contact est auto-créé si nouveau.

### 3. Contacts

**3.1 Création manuelle**
- **Action** : Contacts → New Contact → nom + téléphone E.164.
- **Attendu** : le contact apparaît dans la liste, taguer/déduplication OK.

**3.2 Import CSV**
- **Setup** : CSV de 5+ lignes (nom, téléphone, email).
- **Action** : Contacts → Import → upload, mapper les colonnes.
- **Attendu** : les contacts créés en bulk, doublons fusionnés sur
  le téléphone.

### 4. Inbox

**4.1 Envoi de message**
- **Setup** : une conversation ouverte avec un contact qui t'a écrit
  dans les 24 h.
- **Action** : taper un texte → Send.
- **Attendu** : message envoyé sur WhatsApp, status `sent` puis
  `delivered`/`read` au fil des accusés Meta.

**4.2 Envoi de template (hors fenêtre 24 h)**
- **Setup** : un contact qui n'a pas écrit depuis ≥ 24 h.
- **Action** : icône template → choisir un template approuvé.
- **Attendu** : message template envoyé, status `sent`.

**4.3 Assignation**
- **Setup** : org avec ≥ 2 membres.
- **Action** : ouvrir une conversation → *Assign to* → choisir un
  collègue.
- **Attendu** : la liste *Assign to* ne montre **que les membres de
  l'org active** (pas d'autres orgs). L'assignation est persistée et
  visible dans le sidebar.

### 5. Pipelines & deals

**5.1 Création pipeline + étapes**
- **Action** : Pipelines → Settings → New pipeline → ajouter 3 étapes.
- **Attendu** : pipeline visible dans le board Kanban, étapes
  colorées et ordonnées.

**5.2 Création deal**
- **Setup** : pipeline + au moins 1 contact.
- **Action** : New Deal → titre + montant + contact + étape.
- **Attendu** : carte deal dans la bonne colonne du pipeline. Drag &
  drop entre étapes met à jour `stage_id`.

### 6. Broadcasts

**6.1 Création + envoi immédiat**
- **Setup** : ≥ 3 contacts taggés `client-fidele`.
- **Action** : Broadcasts → New Broadcast → étape 1 choisir un
  template approuvé → étape 2 filtrer sur tag `client-fidele` →
  étape 3 personnaliser variables → étape 4 *Send now*.
- **Attendu** : statut passe `draft → scheduled → sending → sent`,
  compteurs `sent_count` / `delivered_count` / `read_count` montent
  au fil des accusés Meta.

**6.2 Broadcast programmé**
- **Action** : étape 4 *Schedule* → date+heure futur.
- **Attendu** : statut `scheduled` jusqu'à l'heure, puis `sending`.

### 7. Automations

**7.1 Auto-réponse sur mot-clé**
- **Action** : Automations → New → trigger `keyword_match` avec mot
  `prix` → étape `Send Message` (texte) → Activate.
- **Attendu** : un message entrant contenant *prix* déclenche
  l'envoi automatique. Vérifier dans **Logs**.

**7.2 Wait + branch**
- **Action** : automation avec `Wait 1 minute` puis `Send Message`.
- **Attendu** : la 1re étape s'exécute immédiatement, la 2e attend
  ~60 s (drainée par le cron) puis s'envoie.

### 8. Flows

**8.1 Welcome menu**
- **Setup** : Flows → New from template → *Welcome menu*.
- **Action** : Activate, puis envoyer un message au numéro.
- **Attendu** : le flow démarre, envoie le menu avec boutons. Taper
  un bouton avance correctement, taper un texte libre déclenche le
  fallback (reprompt / handoff selon policy).

**8.2 Collect input**
- **Action** : flow avec nœud `collect_input` qui capture un email
  puis l'utilise dans un message suivant via `{{vars.email}}`.
- **Attendu** : la variable est interpolée correctement.

### 9. Agent IA

**9.1 Activation + réponse libre**
- **Setup** : Settings → AI Agent → enable, persona simple, knowledge
  base avec 3-4 infos (ex. horaires, prix d'1 produit, politique de
  retour).
- **Action** : envoyer un message libre type *"vous êtes ouverts le
  samedi ?"* depuis un téléphone test (le contact ne doit être dans
  aucun flow actif, et le message ne doit pas matcher une automation
  `keyword`).
- **Attendu** : l'agent répond en s'appuyant sur la knowledge base.

**9.2 Fallback**
- **Action** : message dont la réponse n'est PAS dans la knowledge
  base.
- **Attendu** : l'agent répond exactement avec le **fallback message**
  configuré.

### 10. Team / multi-agents

**10.1 Invitation**
- **Setup** : être owner / admin.
- **Action** : Settings → Team → Invite → email + rôle agent →
  copier l'URL.
- **Attendu** : invitation visible dans la liste *Pending*.

**10.2 Acceptation**
- **Setup** : créer le user invité côté Supabase Auth (Auto Confirm).
- **Action** : navigation privée → coller l'URL d'invitation → login
  → cliquer *Accept invitation*.
- **Attendu** : atterrissage sur `/dashboard` de l'org de l'inviteur,
  les données de cette org sont visibles, `org_members` a une
  nouvelle ligne.

**10.3 Gardes par rôle**
- **Setup** : se connecter en `agent`.
- **Attendu** : onglet Team visible mais **pas de bouton Invite ni
  de menu d'actions** sur les membres. La liste *Pending invitations*
  est cachée.

**10.4 Isolation cross-org**
- **Setup** : 2 orgs distinctes A et B, un user dans chacune.
- **Action** : créer des contacts/tags dans A, switcher sur B.
- **Attendu** : aucune donnée de A visible dans B. Réciproquement.

### 11. Thème

**11.1 Bascule clair/sombre**
- **Action** : cliquer l'icône soleil/lune dans le header (ou la
  sidebar).
- **Attendu** : tout l'UI bascule instantanément, choix sauvegardé
  (recharge la page → mode conservé).

**11.2 Réduire la sidebar (desktop)**
- **Action** : cliquer le bouton **Collapse** en bas de la nav.
- **Attendu** : sidebar passe à largeur réduite (icônes seulement),
  choix persiste après reload.

### 12. Smoke test rapide (5 minutes)
À faire après chaque déploiement, dans l'ordre :
1. ☐ Login sur un compte existant → atterrissage dashboard, sélecteur
   d'org visible.
2. ☐ Inbox → ouvrir une conversation, envoyer un texte, vérifier le
   `sent` status.
3. ☐ Settings → Team → onglet visible, liste des membres OK.
4. ☐ Settings → AI Agent → édition + save → toast de succès, valeur
   conservée au reload.
5. ☐ Bascule clair/sombre → instantané + sauvegardé.
6. ☐ Switch d'org (si applicable) → données différentes, aucune fuite.

Si une étape échoue : ouvrir une issue immédiatement avec le
contexte (org, user, étape, message d'erreur, console navigateur).

---

*Drwintech — Document de référence utilisateur. Pour les questions
non couvertes ici, contacte ton équipe Drwintech.*
