# RBAC Manual Test Matrix (Sprint 1)

Use this checklist to verify server-side permission enforcement.

## Scope

- `GET /api/admin/members` requires `users:read`
- `POST /api/admin/invitations` requires `users:invite`

## Role → expected access

| Role | `/api/admin/members` | `/api/admin/invitations` |
|------|-----------------------|--------------------------|
| `org_owner` | 200 | 200 |
| `org_admin` | 200 | 200 |
| `content_manager` | 403 | 403 |
| `support_lead` | 403 | 403 |
| `support_agent` | 403 | 403 |
| `viewer` | 200 | 403 |

## Test steps

1. Create at least two users in the same org with different roles.
2. Sign in as each role and call:
   - `GET /api/admin/members`
   - `POST /api/admin/invitations` with `{ "email": "test@example.com", "role": "viewer" }`
3. Confirm status codes match the table above.

## Notes

- The role mapping lives in `lib/rbac.ts`.
- Forbidden responses should include an error containing `Forbidden`.
