# API Design

Base path: `/api/v1`

Tenant-scoped requests must include:

```http
Authorization: Bearer <access-token>
X-Tenant-Slug: acme
```

The backend validates the selected tenant against the authenticated user's active memberships.

## Auth

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Health

- `GET /health`

## Tenants

- `GET /tenants/workspaces`
- `POST /tenants/switch`

## Dashboard

- `GET /dashboard`

## Employees

- `GET /employees`
- `POST /employees`
- `GET /employees/:id`
- `PATCH /employees/:id`
- `POST /employees/:id/disable`
- `POST /employees/:id/reactivate`

## Inventory

- `GET /inventory/items`
- `POST /inventory/items`
- `GET /inventory/items/:id`
- `PATCH /inventory/items/:id`
- `GET /inventory/transactions`
- `POST /inventory/items/:id/adjust`

## Assignments

- `GET /assignments`
- `GET /assignments/vehicles`
- `POST /assignments/inventory`
- `POST /assignments/inventory/:id/return`
- `POST /assignments/vehicles`
- `POST /assignments/vehicles/:id/return`

## Vehicles

- `GET /vehicles`
- `POST /vehicles`
- `GET /vehicles/:id`
- `PATCH /vehicles/:id`

## Administration

- `GET /team`
- `POST /team/invitations`
- `GET /roles`
- `POST /roles`
- `PATCH /roles/:id`
- `GET /audit-log`
- `GET /settings`
- `PATCH /settings`

## Platform Admin

- `GET /platform-admin/tenants`
- `POST /platform-admin/tenants`
- `PATCH /platform-admin/tenants/:id/status`
- `PATCH /platform-admin/tenants/:id/plan`
- `GET /platform-admin/tenants/:id/usage`
