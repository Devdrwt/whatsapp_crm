#!/bin/sh
set -e

# wacrm uses Supabase as its database — the schema is managed via
# supabase/apply_all_migrations.sql in the SQL Editor, NOT from the
# container. Nothing to sync at boot.

echo "→ Starting wacrm on ${HOSTNAME}:${PORT}..."
exec node server.js
