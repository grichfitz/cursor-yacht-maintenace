# YM Access Model v2.1

## Status
Enterprise Hierarchical Governance – Stabilised

## Core Principles

- Access logic lives entirely in Postgres RLS
- Frontend must not implement access filtering
- Hierarchy resolution is centralised in:
  - user_accessible_groups(uuid)
- Role resolution is centralised in:
  - user_is_admin(uuid)
  - user_is_manager(uuid)

## Tables Governed by RLS

- groups
- group_memberships
- yachts
- task_assignments
- user_roles

## Admin Capabilities

- Full role assignment (admin, manager, crew, owner)
- Full group structure control
- Full membership control
- Full yacht control

## Manager Capabilities (Scoped to Subtree)

- View subtree only
- Create subgroups inside subtree
- Update groups inside subtree (not delete)
- Add/remove members inside subtree
- Promote/demote manager role inside subtree
- Create/update/delete yachts inside subtree

## Prohibited in Frontend

The frontend must NOT:

- Compute hierarchy
- Infer access
- Filter by role
- Re-implement membership checks
- Duplicate access logic

All visibility must come from RLS.

## Architectural Intent

This model enables:

- Multi-tenant isolation
- Delegated branch governance
- Deterministic access resolution
- Zero trust frontend
- Enterprise-grade auditability