# Implementation Roadmap

## Phase 1: SaaS foundation

- NestJS app shell
- MongoDB connection and schemas
- JWT auth and refresh token flow
- tenant resolver, tenant guard, tenant context
- memberships and workspace selector API
- permission-based RBAC guard
- seed data for two tenants

## Phase 2: Core domains

- employees CRUD and soft disable/reactivate
- inventory items and categories
- inventory transactions
- inventory assignment and return flow
- vehicles CRUD
- vehicle assignment and return flow
- tenant dashboard

## Phase 3: Governance

- audit log from domain events
- tenant settings
- team invitations
- tenant-specific role management
- platform admin tenant management
- plan and feature limit enforcement

## Phase 4: Product hardening

- integration tests for tenant isolation and IDOR
- structured request logging
- OpenAPI contract review
- UI empty, loading, error states
- production Docker images
- observability hooks

## Current follow-up candidates

- email-backed invite acceptance flow
- persisted refresh token revocation
- richer frontend inline edit forms
- real platform tenant usage metrics

## Out of MVP scope

- Stripe billing
- email provider integration
- barcode scanning
- realtime websocket
- mobile app
- advanced analytics
- suppliers, purchase orders, fuel, maintenance, scheduling
