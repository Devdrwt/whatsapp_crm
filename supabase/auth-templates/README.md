# Supabase Auth — templates email (FR / EN)

Templates HTML branded Drwintech à coller dans
**Supabase Dashboard → Authentication → Email Templates** quand tu
provisionnes un projet (ou que tu veux mettre à jour les emails
auth).

Ils remplacent les 3 emails par défaut de Supabase Auth :

| Fichier | Template Supabase | Quand il part |
|---|---|---|
| `confirm-signup.{lang}.html` | **Confirm signup** | À l'inscription (`signUp`) — l'utilisateur clique pour activer son compte. |
| `reset-password.{lang}.html` | **Reset password** | À `resetPasswordForEmail` — lien temporaire pour définir un nouveau mot de passe. |
| `change-email.{lang}.html` | **Change email address** | À `updateUser({ email })` — envoyé aux DEUX adresses (l'ancienne et la nouvelle). |

> **Magic Link** et **Invite user** ne sont pas couverts : on n'utilise
> pas le passwordless ni l'invite Supabase (Drwintech gère ses propres
> invitations via [src/app/api/orgs/invitations/route.ts](../../src/app/api/orgs/invitations/route.ts)
> + Resend — voir PR 11).

## Quelle langue choisir ?

Supabase Auth ne propose **qu'UN seul jeu de templates par projet**
— pas de variant par utilisateur. Pour Drwintech (cible PME
francophones) la version **FR** est par défaut. Si tu sers un client
anglophone, swap pour la version EN.

Pour passer à du **per-user** (FR ou EN selon une préférence
stockée), il faut basculer sur le **Send Email Hook** Supabase —
chantier de ~2 h documenté dans le changelog comme PR future.

## Procédure de pose

Pour chaque template :

1. Dashboard Supabase → **Authentication → Email Templates**.
2. Sélectionne l'entrée à modifier (`Confirm signup`, `Reset
   password`, `Change email address`).
3. **Subject** : copie la ligne en commentaire HTML au début du
   fichier (`<!-- Subject: ... -->`).
4. **Message body** : passe en mode **HTML source**, colle tout le
   contenu du fichier sans le commentaire subject.
5. **Save**.

## Custom SMTP (recommandé pour la prod)

Par défaut Supabase Auth utilise son SMTP intégré : limite à
**~30 emails/heure**, déliverabilité moyenne, expéditeur générique.
Pour la prod, branche **Resend** comme SMTP custom — même compte
que pour les invitations (PR 11), un seul domaine à vérifier.

**Dashboard → Authentication → SMTP Settings :**

```
Enable Custom SMTP : ON
Sender email       : noreply@drwintech.com   (le même que EMAIL_FROM)
Sender name        : Drwintech
Host               : smtp.resend.com
Port               : 465 (TLS) ou 587 (STARTTLS)
Username           : resend
Password           : <ton RESEND_API_KEY (le même que le .env.local)>
```

Le domaine `drwintech.com` doit être vérifié sur resend.com → Domains
(enregistrements DNS).

## Variables disponibles dans les templates

Supabase Auth utilise la syntaxe Go `text/template` ; les variables
sont entourées de `{{ ... }}` :

- `{{ .ConfirmationURL }}` — l'URL absolue à cliquer (déjà signée).
- `{{ .Token }}` — code OTP 6 chiffres (alternative au lien).
- `{{ .Email }}` — adresse e-mail de l'utilisateur.
- `{{ .SiteURL }}` — base URL configurée dans Settings.
- `{{ .NewEmail }}` — nouvelle adresse, pour le change-email uniquement.

Les templates de ce dossier utilisent uniquement `.ConfirmationURL`
et `.Email`. Si tu veux ajouter le code OTP, on peut ré-ouvrir les
templates.

## Test après pose

1. Ouvre `/signup` → crée un compte avec un e-mail réel.
2. Vérifie la boîte de réception : tu dois recevoir l'e-mail
   « Bienvenue sur Drwintech — confirmez votre adresse » (FR) avec
   le bouton emerald.
3. Clique → tu atterris sur `/dashboard` ou `/onboarding/create-org`
   selon ton état.
4. Pour le reset password : `/forgot-password` → reçoit l'e-mail
   « Réinitialisation de votre mot de passe ».
5. Pour le change-email : Settings → Profile → modifier l'e-mail
   → reçoit l'e-mail aux DEUX adresses (ancienne + nouvelle).
