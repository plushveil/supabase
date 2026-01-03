CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version    text      NOT NULL PRIMARY KEY,
    name       text,
    statements text[]
);
