-- YM DATABASE STRUCTURE EXPORT
-- Authoritative Snapshot Script
-- Run entire file to extract full structure

-- TABLES
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- COLUMNS
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- CONSTRAINTS
SELECT tc.table_name, tc.constraint_type, tc.constraint_name
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public';

-- FOREIGN KEYS
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public';

-- INDEXES
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public';

-- RLS POLICIES
SELECT *
FROM pg_policies
WHERE schemaname = 'public';

-- ENUMS
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typtype = 'e';

-- FUNCTIONS
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

-- TRIGGERS
SELECT event_object_table, trigger_name, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';
