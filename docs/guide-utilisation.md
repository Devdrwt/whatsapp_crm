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

*Drwintech — Document de référence utilisateur. Pour les questions
non couvertes ici, contacte ton équipe Drwintech.*
