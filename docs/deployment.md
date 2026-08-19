# Déploiement — wacrm en production

> Document interne Drwintech — Dernière mise à jour : 2026-08-19
>
> Ce fichier était référencé par `.github/workflows/deploy.yml` depuis la
> PR 15 sans jamais avoir été écrit. Il est rédigé à partir de l'état
> **constaté** sur le serveur, pas d'une intention.

---

## 1. Vue d'ensemble

Le pipeline est **en pull**, pas en push : GitHub construit et publie
l'image, le VPS va la chercher. Aucun secret de production ne transite
par GitHub, et le serveur n'a pas besoin d'être joignable depuis le CI.

```
  push sur main
        │
        ▼
  GitHub Actions (deploy.yml)
   build de l'image Next.js standalone
        │
        ▼
  ghcr.io/devdrwt/wacrm:latest
        │
        ▼           ← déclenché à la main (voir §5)
  VPS : /opt/wacrm/deploy.sh
   docker compose pull + up -d
        │
        ▼
  nginx :443 ──proxy──▶ 127.0.0.1:4000 ──▶ conteneur wacrm-app-1 :3000
```

La base de données est **Supabase (cloud)**. Le schéma n'est pas géré
depuis le conteneur — voir §6.

---

## 2. Le serveur

| | |
|---|---|
| Hôte | `srv1808659.hstgr.cloud` — Hostinger, KVM 8, Royaume-Uni |
| IP | `187.124.214.144` (= enregistrement A de `drwt-crm.drwintech.com`) |
| OS | AlmaLinux 10.2 |
| Ressources | 8 cœurs · 31 Go RAM · 399 Go disque |
| Docker | 29.6.1 · Compose v5.3.0 |

**Cette machine est mutualisée.** Elle héberge aussi `staybj`,
`intralis`, `intralis-essai` et `drwintech-fleet` — environ 25
conteneurs, dont cinq Postgres/TimescaleDB. Toute intervention doit être
scopée à `/opt/wacrm` : un `docker system prune -a` ou un `docker
compose down` lancé depuis le mauvais répertoire touche les autres
projets.

### Accès

```bash
ssh -i ~/.ssh/wacrm_vps_deploy root@187.124.214.144
```

L'authentification est par clé (`PermitRootLogin prohibit-password`). La
console web de hPanel reste le filet de secours : elle ne passe pas par
SSH et fonctionne même si le port 22 est inaccessible.

> **Piège réseau observé.** Depuis certains réseaux (FAI, filtrage
> d'entreprise), les plages Hostinger sont injoignables : SSH, 80 et 443
> tombent tous en timeout alors que le serveur est parfaitement sain.
> Avant de conclure à une panne, vérifier depuis une connexion 4G, ou
> tester le port depuis l'extérieur (check-host.net). Symptôme
> caractéristique : le reste d'Internet répond normalement.

---

## 3. Disposition côté VPS

```
/opt/wacrm/
├── deploy.sh           # pull + up -d + prune
├── docker-compose.yml  # un seul service : app
└── .env                # secrets de production (chmod 600)
```

`deploy.sh` :

```sh
#!/bin/sh
set -e
cd /opt/wacrm
docker compose pull -q app
docker compose up -d
docker image prune -f >/dev/null 2>&1 || true
```

Le `docker-compose.yml` du VPS est volontairement plus court que celui
du dépôt : il ne contient que le service `app`. Le side-car `wa-gateway`
(pilote Baileys) **n'est pas déployé en production** — voir §8.

---

## 4. Variables d'environnement

Elles vivent dans `/opt/wacrm/.env`, jamais dans le dépôt.

| Variable | Rôle |
|---|---|
| `APP_IMAGE` | Image à déployer (défaut : `ghcr.io/devdrwt/wacrm:latest`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Publique — aussi injectée au build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publique — aussi injectée au build |
| `NEXT_PUBLIC_SITE_URL` | `https://drwt-crm.drwintech.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — contourne la RLS |
| `ENCRYPTION_KEY` | **Secret** — AES-256-GCM des tokens WhatsApp |
| `META_APP_SECRET` | **Secret** — signature des webhooks Meta |
| `AUTOMATION_CRON_SECRET` | **Secret** — en-tête `x-cron-secret` |
| `RESEND_API_KEY` | Optionnel — sans lui, les invitations retombent sur « copier le lien » |
| `EMAIL_FROM` | Identité d'expédition |

Les trois `NEXT_PUBLIC_*` sont **inlinées dans le bundle client au
build**. Les changer dans le `.env` ne suffit pas : il faut aussi les
mettre à jour dans **GitHub → Settings → Variables** (des *Variables*,
pas des *Secrets* — elles sont publiques par nature) et reconstruire.

Ne jamais faire tourner `ENCRYPTION_KEY` : chaque token WhatsApp chiffré
devient indéchiffrable et tous les clients doivent ressaisir leur
configuration.

---

## 5. Déployer

### Prérequis : l'ordre migration → image

**Toute migration de schéma s'applique AVANT que la nouvelle image ne
parte.** Le code déployé suppose le schéma présent ; l'inverse casse en
production. Exemple concret, PR 16 : `/api/whatsapp/config` écrit les
colonnes `provider` et `session_*`. Sans la migration `020`, enregistrer
une configuration WhatsApp échoue sur une colonne inexistante.

### Procédure

```bash
# 1. Appliquer les migrations en attente sur Supabase (SQL Editor)

# 2. Merger vers main → GitHub Actions construit et pousse l'image
#    Suivre l'onglet Actions jusqu'au vert.

# 3. Récupérer l'image sur le VPS
ssh -i ~/.ssh/wacrm_vps_deploy root@187.124.214.144
/opt/wacrm/deploy.sh

# 4. Vérifier
docker ps --filter name=wacrm-app-1
docker inspect wacrm-app-1 --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/     # 307 attendu
docker logs --tail 50 wacrm-app-1
```

La révision affichée à l'étape 4 doit correspondre au SHA du commit
mergé. C'est la seule preuve fiable que la nouvelle image tourne — un
`docker ps` vert ne dit rien de la version.

### L'étape 3 est manuelle

`deploy.yml` mentionne un cron toutes les 3 minutes. **Il n'existe
pas** : ni crontab, ni `/etc/cron.d`, ni timer systemd. C'est pour cela
qu'une image de six semaines a pu rester en production alors que `main`
avait avancé.

Pour l'automatiser :

```bash
( crontab -l 2>/dev/null; echo '*/3 * * * * /opt/wacrm/deploy.sh >> /var/log/wacrm-deploy.log 2>&1' ) | crontab -
```

À n'installer qu'en connaissance de cause : le déploiement devient
automatique dès le merge, ce qui **retire la fenêtre permettant
d'appliquer une migration avant l'image**. Avec le cron, la migration
doit impérativement passer *avant* le merge, pas entre le merge et le
déploiement.

---

## 6. Base de données

Supabase (cloud). Le schéma est appliqué **à la main** via le SQL Editor
— `docker-entrypoint.sh` ne synchronise rien au démarrage, par choix.

Les migrations sont dans `supabase/migrations/`, numérotées, et écrites
pour être idempotentes : les rejouer est sans effet.

Pour une instance neuve, `supabase/apply_all_migrations.sql` regroupe
l'ensemble.

---

## 7. nginx et TLS

Le vhost est `/etc/nginx/conf.d/drwt-crm.drwintech.com.conf` : TLS 1.2/1.3,
certificat Let's Encrypt géré par Certbot, redirection 80 → 443, et
proxy vers `127.0.0.1:4000`.

`client_max_body_size 25m` — dimensionné pour les imports CSV de contacts
et les médias WhatsApp. Le conteneur n'expose son port que sur la
loopback : il n'est jamais joignable directement depuis Internet.

Après toute modification :

```bash
nginx -t && systemctl reload nginx
```

---

## 8. Side-car pilote Baileys

**Non déployé en production, et c'est délibéré.**

Le `docker-compose.yml` du dépôt décrit un service `wa-gateway` derrière
le profil Docker `pilot`, que `docker compose up` ne démarre pas. Le
`.env` du VPS ne contient aucune variable `WA_GATEWAY_*`, ce qui laisse
le transport pilote entièrement éteint : la route d'appairage répond
503 et le webhook rejette toute charge signée par le gateway.

C'est l'état correct pour une production qui sert des clients. Voir
[pilote-baileys.md](pilote-baileys.md).

---

## 9. Revenir en arrière

Les images sont taguées par SHA de commit en plus de `latest` :

```bash
# Sur le VPS, épingler la révision précédente
cd /opt/wacrm
sed -i 's|^APP_IMAGE=.*|APP_IMAGE=ghcr.io/devdrwt/wacrm:sha-<SHA_PRECEDENT>|' .env
docker compose up -d
```

Penser à **remettre `APP_IMAGE` sur `latest`** une fois le correctif
publié, sinon les déploiements suivants n'auront aucun effet visible et
le diagnostic sera pénible.

Un retour arrière de code ne défait pas une migration de schéma. Les
migrations étant additives (ajouts de colonnes, valeurs par défaut), une
image antérieure tourne normalement sur un schéma plus récent — c'est
voulu, et c'est ce qui rend le retour arrière sûr.

Hostinger conserve par ailleurs des snapshots du VPS (2 au dernier
relevé) : filet de sécurité de dernier recours, à l'échelle de la
machine entière, tous projets confondus.

---

## 10. Diagnostic

| Symptôme | Piste |
|---|---|
| SSH, 80 et 443 tous en timeout, reste d'Internet OK | Filtrage réseau côté client, pas une panne serveur — voir §2 |
| `deploy.sh` ne change rien | `APP_IMAGE` épinglé sur un SHA dans `.env` |
| Le site répond 502 | Conteneur arrêté : `docker logs wacrm-app-1` |
| Enregistrer la config WhatsApp échoue | Migration en retard sur l'image — voir §5 |
| Messages entrants absents | `META_APP_SECRET` : le webhook ferme en cas d'absence ou d'écart |
| Tokens WhatsApp indéchiffrables | `ENCRYPTION_KEY` modifiée ; réinitialiser la config depuis l'UI |
