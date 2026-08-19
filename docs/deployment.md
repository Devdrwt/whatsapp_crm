# Déploiement — wacrm en production

> Document interne Drwintech — Dernière mise à jour : 2026-08-19
>
> Rédigé à partir de l'état **constaté** sur le serveur, pas d'une
> intention. Depuis le 19/08/2026, la base n'est plus sur Supabase cloud
> mais auto-hébergée sur le VPS (§6).

---

## 1. Vue d'ensemble

Le pipeline applicatif est **en pull**, pas en push : GitHub construit et
publie l'image, le VPS va la chercher. Aucun secret de production ne
transite par GitHub, et le serveur n'a pas besoin d'être joignable depuis
le CI.

```
  push sur main
        │
        ▼
  GitHub Actions (deploy.yml) ──▶ ghcr.io/devdrwt/wacrm:latest
        │
        ▼   ← déclenché à la main (§5)
  VPS : /opt/wacrm/deploy.sh   →  docker compose pull + up -d
        │
        ▼
  nginx :443  ──▶ 127.0.0.1:4000  ──▶ wacrm-app-1 :3000
                                            │
                                            ▼
  nginx :443  ──▶ 127.0.0.1:8100  ──▶ Supabase auto-hébergé
  (api-crm.drwintech.com)               (/opt/supabase, 11 conteneurs)
```

Deux stacks distinctes sur la même machine, deux domaines :

| Domaine | Sert |
|---|---|
| `drwt-crm.drwintech.com` | l'application Next.js |
| `api-crm.drwintech.com` | l'API Supabase (auth, rest, storage, realtime) |

Le second est appelé **depuis le navigateur du client**, pas seulement
par le serveur : ce n'est pas un service interne, il doit rester
publiquement joignable en HTTPS.

---

## 2. Le serveur

| | |
|---|---|
| Hôte | `srv1808659.hstgr.cloud` — Hostinger, KVM 8, Royaume-Uni |
| IP | `187.124.214.144` (A de `drwt-crm` **et** `api-crm`) |
| OS | AlmaLinux 10.2 |
| Ressources | 8 cœurs · 31 Go RAM · 399 Go disque |
| Docker | 29.6.1 · Compose v5.3.0 |

**Cette machine est mutualisée.** Elle héberge aussi `staybj`,
`intralis`, `intralis-essai` et `drwintech-fleet` — une trentaine de
conteneurs. Toute intervention doit être scopée au bon répertoire : un
`docker system prune -a` ou un `docker compose down` lancé au mauvais
endroit touche les autres projets.

### Accès

```bash
ssh -i ~/.ssh/wacrm_vps_deploy root@187.124.214.144
```

Authentification par clé (`PermitRootLogin prohibit-password`). La
console web de hPanel est le filet de secours : elle ne passe pas par
SSH.

---

## 3. Disposition côté VPS

```
/opt/wacrm/                    application
├── deploy.sh                  pull + up -d + prune
├── docker-compose.yml         un seul service : app
├── .env                       secrets de production (chmod 600)
└── .env.bak-cloud-*           configuration Supabase cloud, avant bascule

/opt/supabase/                 base de données
├── docker-compose.yml         stack officielle amont
├── docker-compose.override.yml correctifs locaux (§6.3)
├── .env                       secrets de la stack (chmod 600)
├── backup.sh                  dump quotidien
├── backups/                   rétention 14 jours
└── volumes/db/data            données PostgreSQL
```

---

## 4. Variables d'environnement de l'application

Dans `/opt/wacrm/.env`, jamais dans le dépôt.

| Variable | Rôle |
|---|---|
| `APP_IMAGE` | Image déployée (défaut `ghcr.io/devdrwt/wacrm:latest`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://api-crm.drwintech.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publique (JWT rôle `anon`) |
| `NEXT_PUBLIC_SITE_URL` | `https://drwt-crm.drwintech.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — contourne la RLS |
| `ENCRYPTION_KEY` | **Secret** — AES-256-GCM des tokens WhatsApp |
| `META_APP_SECRET` | **Secret** — signature des webhooks Meta |
| `AUTOMATION_CRON_SECRET` | **Secret** — en-tête `x-cron-secret` |
| `RESEND_API_KEY` | Optionnel — **actuellement vide**, les invitations ne partent donc pas par e-mail |
| `EMAIL_FROM` | Identité d'expédition |

Les `NEXT_PUBLIC_*` sont **inlinées dans le bundle client au build**. Les
modifier dans le `.env` ne suffit pas : il faut aussi les mettre à jour
dans **GitHub → Settings → Variables** (des *Variables*, pas des
*Secrets* — elles sont publiques par nature) puis **reconstruire
l'image**. Changer de base de données est donc un déploiement complet,
pas un basculement de configuration.

Ne jamais faire tourner `ENCRYPTION_KEY` : chaque token WhatsApp chiffré
deviendrait indéchiffrable.

---

## 5. Déployer l'application

### Prérequis : l'ordre migration → image

**Toute migration de schéma s'applique AVANT que la nouvelle image ne
parte.** Le code déployé suppose le schéma présent ; l'inverse casse en
production. Exemple vécu, PR 16 : `/api/whatsapp/config` écrit les
colonnes `provider` et `session_*`. Sans la migration `020`, enregistrer
une configuration WhatsApp échoue sur une colonne inexistante.

### Procédure

```bash
# 1. Appliquer les migrations en attente (§6.2)
# 2. Merger vers main → GitHub Actions construit et pousse l'image
# 3. Récupérer l'image sur le VPS
ssh -i ~/.ssh/wacrm_vps_deploy root@187.124.214.144
/opt/wacrm/deploy.sh

# 4. Vérifier
docker inspect wacrm-app-1 --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/     # 307 attendu
docker logs --tail 50 wacrm-app-1
```

La révision affichée doit correspondre au SHA du commit mergé. C'est la
seule preuve fiable que la nouvelle image tourne — un `docker ps` vert ne
dit rien de la version.

### L'étape 3 est manuelle

`deploy.yml` mentionne un cron toutes les 3 minutes. **Il n'existe pas.**
C'est pour cela qu'une image de six semaines a pu rester en production
alors que `main` avait avancé.

Pour l'automatiser :

```bash
( crontab -l 2>/dev/null; echo '*/3 * * * * /opt/wacrm/deploy.sh >> /var/log/wacrm-deploy.log 2>&1' ) | crontab -
```

À n'installer qu'en connaissance de cause : le déploiement devient
automatique dès le merge, ce qui **retire la fenêtre permettant
d'appliquer une migration entre le merge et le déploiement**. Avec le
cron, la migration doit impérativement passer *avant* le merge.

---

## 6. La base de données

Depuis le 19/08/2026, **Supabase auto-hébergé sur le VPS**. Le projet
cloud (`rssicjiqjljawegelbbh`, eu-west-1) existe toujours et sert de
repli — ne pas le supprimer avant plusieurs semaines d'exploitation
sereine.

### 6.1 La stack

11 conteneurs dans `/opt/supabase` : `db` (PostgreSQL 17.6), `auth`
(GoTrue), `rest` (PostgREST), `realtime`, `storage`, `imgproxy`, `meta`,
`studio`, `api-gw` (Envoy), `supavisor`, `functions`.

Ports publiés **uniquement sur la loopback** :

| Port | Service |
|---|---|
| `127.0.0.1:8100` | passerelle Envoy → exposée via `api-crm.drwintech.com` |
| `127.0.0.1:5433` | pooler (session) — 5432 est pris par le PostgreSQL bare-metal de l'hôte |
| `127.0.0.1:6543` | pooler (transaction) |

**Studio n'est pas exposé publiquement.** Il donne un accès
administrateur complet à la base ; le vhost renvoie 404 sur tout ce qui
n'est pas un préfixe d'API. Pour l'ouvrir :

```bash
ssh -i ~/.ssh/wacrm_vps_deploy -L 8100:127.0.0.1:8100 root@187.124.214.144
# puis http://127.0.0.1:8100/ — identifiants dans /opt/supabase/.env
# (DASHBOARD_USERNAME / DASHBOARD_PASSWORD)
```

### 6.2 Appliquer une migration

Les migrations sont dans `supabase/migrations/`, numérotées, écrites pour
être idempotentes.

```bash
scp -i ~/.ssh/wacrm_vps_deploy supabase/migrations/0XX_*.sql root@187.124.214.144:/tmp/m.sql
ssh -i ~/.ssh/wacrm_vps_deploy root@187.124.214.144 \
  'docker cp /tmp/m.sql supabase-db:/tmp/m.sql && \
   docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/m.sql && \
   rm -f /tmp/m.sql'
```

Après une migration qui touche des tables, recharger le cache de schéma
de PostgREST, sinon les nouvelles colonnes restent invisibles à l'API :

```bash
docker compose -f /opt/supabase/docker-compose.yml restart rest
```

### 6.3 Correctifs locaux — pourquoi l'override existe

`docker-compose.override.yml` n'est pas cosmétique, chacun de ses points
a coûté un échec de démarrage :

1. **`dns_search: .`** — le `/etc/resolv.conf` de l'hôte porte `search
   localhost`. Comme `.localhost` est réservé à la loopback (RFC 6761),
   un nom court comme `db` se résout en `db.localhost` → `::1`, et chaque
   service se connecte à lui-même. Symptôme : Envoy annonce ses clusters
   en `[::1]`, Realtime boucle sur `connection refused`. Le correctif est
   circonscrit à cette stack ; **le défaut reste latent pour les autres
   projets du VPS.**
2. **`ports: !override` sur `supavisor`** — le port 5432 de l'hôte est
   occupé par le PostgreSQL bare-metal. Sans le tag `!override`, Compose
   *ajoute* à la liste amont au lieu de la remplacer.

Deux autres pièges, réglés dans `.env` :

3. **`POSTGRES_PORT` a un double rôle** — publication hôte *et* port
   interne du moteur. Y mettre `127.0.0.1:5433` fait refuser Postgres au
   démarrage (`invalid value for parameter "port"`). Il doit rester
   `5432` ; la publication se règle dans l'override.
4. **`COMPOSE_FILE` explicite** dans le `.env` désactive le chargement
   automatique de `docker-compose.override.yml`. Il faut l'y déclarer :
   `COMPOSE_FILE=docker-compose.yml:docker-compose.override.yml`.

### 6.4 Sauvegardes

`/opt/supabase/backup.sh`, quotidien à 3h17 (cron root), vers
`/opt/supabase/backups`, rétention 14 jours. Le script **refuse un dump
de moins de 10 Ko** plutôt que de l'archiver : un dump tronqué est pire
qu'un dump absent, il donne une fausse impression de sécurité.

Restaurer :

```bash
gunzip -c /opt/supabase/backups/wacrm-AAAAMMJJ-HHMM.sql.gz \
  | docker exec -i supabase-db psql -U postgres -d postgres
```

Hostinger conserve par ailleurs des snapshots du VPS entier — filet de
dernier recours, tous projets confondus.

---

## 7. nginx et TLS

Deux vhosts dans `/etc/nginx/conf.d/`, tous deux avec certificat Let's
Encrypt géré par Certbot et redirection 80 → 443 :

- `drwt-crm.drwintech.com.conf` → `127.0.0.1:4000`, `client_max_body_size 25m`
- `api-crm.drwintech.com.conf` → `127.0.0.1:8100`, `client_max_body_size 50m`

Le second ne route que les préfixes d'API (`/auth/`, `/rest/`,
`/storage/`, `/functions/`, `/realtime/`) et renvoie **404 sur tout le
reste**, ce qui ferme l'accès public à Studio. `/realtime/` porte la
bascule WebSocket et un `proxy_read_timeout` de 3600 s — sans quoi
l'inbox temps réel se ferait couper toutes les 60 s.

La map WebSocket est nommée `$crm_connection_upgrade` : `api-fleet`
définit déjà la sienne dans le même répertoire, et deux variables
homonymes en contexte `http` empêcheraient nginx de recharger.

```bash
nginx -t && systemctl reload nginx
```

---

## 8. Side-car pilote Baileys

**Non déployé en production, délibérément.**

Le service `wa-gateway` est derrière le profil Docker `pilot`, que
`docker compose up` ne démarre pas, et le `.env` du VPS ne contient
aucune variable `WA_GATEWAY_*`. Le transport pilote est donc entièrement
éteint : la route d'appairage répond 503 et le webhook rejette toute
charge signée par le gateway.

C'est l'état correct pour une production qui sert des clients. Voir
[pilote-baileys.md](pilote-baileys.md).

---

## 9. Revenir en arrière

### Application

Les images sont taguées par SHA en plus de `latest` :

```bash
cd /opt/wacrm
sed -i 's|^APP_IMAGE=.*|APP_IMAGE=ghcr.io/devdrwt/wacrm:sha-<SHA_PRECEDENT>|' .env
docker compose up -d
```

**Remettre `APP_IMAGE` sur `latest`** une fois le correctif publié, sinon
les déploiements suivants n'auront aucun effet visible.

### Base de données

Le projet Supabase cloud est intact. Pour y revenir :

```bash
cp /opt/wacrm/.env.bak-cloud-* /opt/wacrm/.env   # anciennes clés + URL
```

…puis remettre les anciennes valeurs dans les Variables GitHub et
**reconstruire l'image** — les `NEXT_PUBLIC_*` sont inlinées au build.

Un retour arrière de code ne défait pas une migration de schéma. Les
migrations étant additives, une image antérieure tourne normalement sur
un schéma plus récent : c'est voulu, et c'est ce qui rend le retour
arrière sûr.

---

## 10. Diagnostic

| Symptôme | Piste |
|---|---|
| **Tous** les sites du VPS injoignables, SSH OK | firewalld : `firewall-cmd --list-services` doit contenir `http https`. Un redémarrage perd les règles posées sans `--permanent` — c'est arrivé le 19/08 |
| SSH, 80 et 443 en timeout mais le reste d'Internet répond | Filtrage réseau côté client. Vérifier depuis une 4G, ou tester le port depuis l'extérieur (check-host.net) avant de conclure à une panne serveur |
| `deploy.sh` ne change rien | `APP_IMAGE` épinglé sur un SHA dans `.env` |
| Le site répond 502 | `docker logs wacrm-app-1` |
| Services Supabase en `connection refused` entre eux | Le piège `search localhost` — voir §6.3 |
| Nouvelle colonne invisible depuis l'API | Cache de schéma PostgREST — voir §6.2 |
| Enregistrer la config WhatsApp échoue | Migration en retard sur l'image — voir §5 |
| Messages entrants absents | `META_APP_SECRET` : le webhook ferme en cas d'absence ou d'écart |
| Tokens WhatsApp indéchiffrables | `ENCRYPTION_KEY` modifiée ; réinitialiser la config depuis l'UI |
| Utilisateurs déconnectés en masse | Les clés JWT de la stack ont changé — normal après une bascule de base |
