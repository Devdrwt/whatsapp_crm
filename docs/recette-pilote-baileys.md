# Recette du transport pilote (Baileys)

> Document interne Drwintech — 2026-08-19
>
> Complète le [guide de recette](guide-utilisation.md#guide-de-recette--comment-tester)
> du guide d'utilisation, qui suppose l'API Meta officielle. Le pilote
> change trois choses : l'appairage, le rendu des menus, et ce qui est
> volontairement refusé.
>
> **Numéro de test uniquement.** Ce transport viole les CGU de WhatsApp ;
> en cas de bannissement, le numéro appairé est perdu. Ne jamais utiliser
> le numéro commercial d'un client, ni le tien.

Même convention que le guide existant : **Setup → Action → Attendu**.
Coche quand c'est vert.

---

## 0. Prérequis

- Side-car démarré : `docker ps --filter name=wacrm-wa-gateway-1` → `healthy`
- Ton compte est `super_admin` (`profiles.role`)
- **Téléphone A** — celui qu'on appaire (numéro jetable)
- **Téléphone B** — celui qui joue le client, pour envoyer les messages entrants
- Org cible : `drwt_crm` → `73f4da8e-a2df-44eb-8cea-01dea9f94c0b`

Sans téléphone B, la moitié des scénarios est intestable : on ne peut pas
simuler un message entrant depuis l'application.

---

## 1. Appairage

**1.1 Démarrer la session**
- **Setup** : connecté sur `https://drwt-crm.drwintech.com`, console du
  navigateur ouverte (`F12`).
- **Action** :
  ```js
  await fetch('/api/admin/whatsapp-pilot/73f4da8e-a2df-44eb-8cea-01dea9f94c0b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: '216XXXXXXXX' })   // téléphone A, sans +
  }).then(r => r.json())
  ```
- **Attendu** : `{ state: 'pairing', pairingCode: 'XXXXXXXX', ... }`.
  Un code de 8 caractères.

**1.2 Saisir le code sur le téléphone A**
- **Action** : WhatsApp → Paramètres → Appareils connectés → Connecter un
  appareil → « Se connecter avec un numéro de téléphone » → saisir le code.
- **Attendu** : le téléphone affiche l'appareil connecté sous le nom
  `wacrm-pilot`.

**1.3 Confirmer côté serveur**
- **Action** : rejouer le `fetch` de 1.1 en `GET` (sans `method`, `body`,
  `headers`).
- **Attendu** : `{ state: 'connected', phoneNumber: '216XXXXXXXX' }`.

**1.4 La configuration est enregistrée**
- **Action** : Réglages → WhatsApp dans l'application.
- **Attendu** : la connexion est reconnue. En base,
  `whatsapp_config` contient une ligne avec `provider = 'baileys'` et
  `phone_number_id` égal au numéro appairé.

> Si 1.3 reste bloqué sur `pairing` plus de deux minutes, le code a
> expiré : rejouer 1.1.

---

## 2. Réception (téléphone B → CRM)

**2.1 Message texte**
- **Action** : depuis le téléphone B, envoyer « bonjour » au téléphone A.
- **Attendu** : en quelques secondes, la conversation apparaît dans
  l'Inbox ; le contact est créé automatiquement avec le nom du profil
  WhatsApp.

**2.2 Média**
- **Action** : envoyer une photo avec légende.
- **Attendu** : la bulle image s'affiche et **l'image se charge**. Si
  elle reste vide, le média n'a pas été récupéré — c'est un échec, pas un
  détail d'affichage (les clés de déchiffrement WhatsApp sont à usage
  unique, un média manqué est définitivement perdu).

**2.3 Réponse citée**
- **Action** : depuis B, glisser pour répondre à un message précédent.
- **Attendu** : le message arrive rattaché au parent. L'aperçu du message
  cité peut être vide — c'est une limite connue et acceptée du pilote.

**2.4 Réaction**
- **Action** : depuis B, réagir 👍 à un message.
- **Attendu** : la réaction apparaît sous la bulle. **Aucun nouveau
  message** ne doit être créé dans le fil.

---

## 3. Émission (CRM → téléphone B)

**3.1 Réponse depuis l'Inbox**
- **Action** : dans la conversation, écrire et envoyer.
- **Attendu** : reçu sur B en quelques secondes ; la bulle passe à
  « envoyé » dans l'Inbox.

**3.2 Réaction depuis l'Inbox**
- **Action** : réagir à un message reçu.
- **Attendu** : la réaction apparaît sur B.
- **Limite** : ne fonctionne que sur les messages échangés **depuis
  l'appairage**. Le gateway n'indexe que les 2 000 derniers ; au-delà,
  l'erreur est explicite, ce n'est pas un plantage.

---

## 4. Automations

**4.1 Auto-réponse sur mot-clé**
- **Setup** : une automation active, déclencheur « mot-clé » sur `prix`,
  action « envoyer un message ».
- **Action** : depuis B, envoyer « quel est le prix ? ».
- **Attendu** : la réponse automatique arrive sur B, et apparaît dans le
  fil avec `sender_type = 'bot'`.

---

## 5. Flows — le point le plus important

C'est ici que le pilote diffère le plus de Meta. Les boutons et listes
sont rendus en **menu texte numéroté**, et la réponse est remappée vers
l'identifiant d'option attendu par le moteur. Le runner ne doit pas voir
la différence.

**5.1 Rendu du menu**
- **Setup** : activer le flow « Welcome menu ».
- **Action** : depuis B, déclencher le flow.
- **Attendu** : un message texte du type :
  ```
  *Bienvenue*

  Que voulez-vous faire ?

  1. Tarifs
  2. Support
  ```
  Et **non** une bulle vide ou un message tronqué.

**5.2 Réponse par numéro**
- **Action** : répondre `2`.
- **Attendu** : le flow avance sur la branche « Support », exactement
  comme si un bouton avait été tapé.

**5.3 Réponse par libellé**
- **Action** : relancer le flow, puis répondre `tarifs` (minuscules, sans
  accent).
- **Attendu** : le flow avance sur « Tarifs ». La correspondance ignore
  la casse et les accents.

**5.4 Réponse hors menu — le test qui compte**
- **Action** : relancer le flow, puis répondre « vous ouvrez à quelle
  heure ? ».
- **Attendu** : le message est traité comme **du texte ordinaire**. Le
  flow ne doit **pas** avancer sur une branche.
- **Pourquoi** : interpréter une vraie question comme un appui de bouton
  enverrait le client sur un chemin qu'il n'a pas choisi, sans que
  personne ne s'en aperçoive. C'est le scénario le plus important de
  cette recette.

**5.5 `collect_input`**
- **Setup** : un flow avec une étape de capture de réponse.
- **Action** : répondre librement à la question posée.
- **Attendu** : la valeur est capturée et réutilisable via `{{vars.X}}`
  plus loin dans le flow.

---

## 6. Ce qui doit échouer — les garde-fous

Ces scénarios sont réussis **quand ils échouent**. Un succès ici serait
un défaut.

**6.1 Broadcast refusé**
- **Action** : Broadcasts → créer et envoyer une campagne.
- **Attendu** : refus explicite (400) mentionnant que les broadcasts
  exigent l'API Meta.
- **Pourquoi** : l'envoi en masse est ce qui fait bannir un numéro.

**6.2 Template refusé**
- **Action** : depuis l'Inbox, tenter l'envoi d'un template.
- **Attendu** : erreur explicite indiquant que les templates n'existent
  que sur l'API Cloud.

**6.3 La route d'appairage est fermée aux non-administrateurs**
- **Setup** : un compte sans `role = 'super_admin'`.
- **Action** : rejouer le `fetch` de 1.1 avec cette session.
- **Attendu** : `403 Forbidden`.

---

## 7. Résilience

**7.1 Redémarrage du side-car**
- **Action** : `docker restart wacrm-wa-gateway-1`, attendre 30 s.
- **Attendu** : la session repasse à `connected` **sans nouvel
  appairage** — les credentials sont sur le volume.

**7.2 Dépairage**
- **Action** : rejouer le `fetch` de 1.1 en `DELETE`.
- **Attendu** : `{ ok: true }`. Le téléphone A ne montre plus l'appareil
  connecté, et la ligne `whatsapp_config` a disparu.

---

## 8. Correspondance avec le guide de recette existant

| Section du guide d'utilisation | Sur le pilote |
|---|---|
| 1. Compte & onboarding | applicable tel quel |
| 2. Connexion WhatsApp | **remplacée** par la section 1 ci-dessus |
| 3. Contacts | applicable tel quel |
| 4. Inbox | applicable, sauf 4.2 (template) → voir 6.2 |
| 5. Pipelines & deals | applicable tel quel |
| 6. Broadcasts | **non applicable** → voir 6.1 |
| 7. Automations | applicable |
| 8. Flows | applicable, **avec la section 5 en complément** |
| 9. Agent IA | applicable |
| 10. Équipe & rôles | applicable, mais 10.1bis exige `RESEND_API_KEY`, **actuellement vide** |
| 11. Interface | applicable tel quel |

---

## 9. Après la recette

**Dépairer** (7.2) si le numéro de test n'est pas dédié à ça. Une session
laissée ouverte continue de recevoir, et de consommer un emplacement
d'appareil connecté sur le téléphone.

**Ce que cette recette ne prouve pas.** Elle valide que le CRM fonctionne
de bout en bout avec un vrai WhatsApp. Elle ne dit rien de la voie
officielle : quotas Meta, fenêtre de 24 h, approbation des templates,
qualité du numéro, facturation par conversation. Ces comportements
n'existent que sur l'API Cloud et devront être repassés le jour où un
WABA sera en place.

Voir [pilote-baileys.md](pilote-baileys.md) pour le cadre d'usage et les
limites assumées.
