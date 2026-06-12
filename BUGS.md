# TaskBoard — Verified Bug Report

Analysis date: 2026-06-12  
Environment: `http://localhost:3000` (seed data, password `password123`)

All API findings below were confirmed against the running application. UI findings were confirmed by code inspection and manual reproduction steps.

---

## Bug 1 — Missing Authorization on Task Updates

| Field | Detail |
|-------|--------|
| **File & line** | `src/app/api/tasks/[id]/route.ts` — lines 16–37 (update at lines 29–35; no membership/role check, unlike DELETE at lines 49–53) |
| **Category** | Role-based access control |
| **Business impact** | Critical — any authenticated user can modify any task, including viewers and users who are not members of the task's project |
| **Curl proof** | Yes |

### Reproduction steps

1. Log in as **Meera** (`meera@taskboard.dev`) and note a task ID from **Q3 Launch**.
2. Log in as **Dev** (`dev@example.com`) — a **viewer** on Q3 Launch only.
3. Send `PATCH /api/tasks/{taskId}` with a new title.
4. **Expected:** `403 Forbidden`
5. **Actual:** `200 OK` — task title is updated.

**Cross-project variant:** Log in as **Lina** (`lina@example.com`), who is **not** a member of Q3 Launch. `PATCH` the same task → `200 OK`.

### Curl proof

```bash
DEV_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123"}' | jq -r .token)

curl -s -w "\nHTTP:%{http_code}\n" -X PATCH http://localhost:3000/api/tasks/<TASK_ID> \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"VIEWER-HACKED-TITLE"}'
# → HTTP:200
```

Assessment test `src/tests/part2.test.ts` (lines 48–57) expects `403` for this scenario.

---

## Bug 2 — SQL Injection in Task Search

| Field | Detail |
|-------|--------|
| **File & line** | `src/app/api/projects/[id]/tasks/route.ts` — lines 27–34 |
| **Category** | Security |
| **Business impact** | Critical — authenticated project members can inject SQL via the `q` search parameter, bypassing intended search filters and exposing arbitrary database reads |
| **Curl proof** | Yes |

### Reproduction steps

1. Log in as any **Q3 Launch** member (e.g. Meera).
2. Get the Q3 Launch `projectId` from `GET /api/projects`.
3. Normal search: `GET /api/projects/{id}/tasks?q=launch` → returns 1 matching task.
4. Inject: `GET /api/projects/{id}/tasks?q=%' OR '1'='1` (URL-encoded).
5. **Expected:** Safe parameterized search returning only legitimate matches.
6. **Actual:** Returns all 8 tasks in the project (boolean bypass).

### Curl proof

```bash
MEERA_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"meera@taskboard.dev","password":"password123"}' | jq -r .token)

PROJECT_ID=<Q3_LAUNCH_ID>

# Normal search → 1 task
curl -s "http://localhost:3000/api/projects/$PROJECT_ID/tasks?q=launch" \
  -H "Authorization: Bearer $MEERA_TOKEN" | jq '.tasks | length'

# Injection → 8 tasks (all project tasks)
curl -s "http://localhost:3000/api/projects/$PROJECT_ID/tasks?q=%25%27%20OR%20%271%27%3D%271" \
  -H "Authorization: Bearer $MEERA_TOKEN" | jq '.tasks | length'
```

---

## Bug 3 — Password Hashes Exposed in Project API

| Field | Detail |
|-------|--------|
| **File & line** | `src/app/api/projects/[id]/route.ts` — lines 28–30 (`owner: true`, `user: true` include full User rows) |
| **Category** | Security |
| **Business impact** | High — any project member (including viewers) receives bcrypt password hashes for the owner and all members, enabling offline cracking |
| **Curl proof** | Yes |

### Reproduction steps

1. Log in as **Dev** (`dev@example.com`) — viewer on Q3 Launch.
2. `GET /api/projects/{q3_launch_id}` with Dev's token.
3. Inspect `project.owner.passwordHash` and `project.memberships[].user.passwordHash`.
4. **Expected:** Only safe fields (`id`, `name`, `email`).
5. **Actual:** Full `passwordHash` values returned (e.g. `$2a$10$8GOo7vf6dPAZo...`).

### Curl proof

```bash
DEV_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123"}' | jq -r .token)

curl -s "http://localhost:3000/api/projects/<PROJECT_ID>" \
  -H "Authorization: Bearer $DEV_TOKEN" | jq '.project.owner.passwordHash'
# → "$2a$10$..."
```

---

## Bug 4 — No Role-Based UI Gating for Edit Controls

| Field | Detail |
|-------|--------|
| **File & line** | `src/app/projects/[id]/page.tsx` — lines 96–138; `src/components/TaskDetail.tsx` — lines 47–55, 132–154 |
| **Category** | UI validation |
| **Business impact** | Medium–High — viewers see the same create/edit/delete UI as admins and members; combined with Bug 1, viewers can successfully modify tasks from the UI |
| **Curl proof** | No (frontend-only; underlying write succeeds via API — see Bug 1) |

### Reproduction steps

1. Log in as **Dev** (`dev@example.com`) — **viewer** on Q3 Launch.
2. Open the **Q3 Launch** project page.
3. Observe the **"add a task"** form is visible and usable.
4. Click any task card → **TaskDetail** modal opens with **Save** and **Delete** buttons.
5. Edit the title and click **Save**.
6. **Expected:** UI hides or disables write actions for viewers.
7. **Actual:** Full edit UI is shown; save succeeds (PATCH has no RBAC — Bug 1).

---

## Summary

| # | Category | Severity | File:Line | Curl proof |
|---|----------|----------|-----------|------------|
| 1 | RBAC | Critical | `src/app/api/tasks/[id]/route.ts:16–37` | Yes |
| 2 | Security (SQLi) | Critical | `src/app/api/projects/[id]/tasks/route.ts:27–34` | Yes |
| 3 | Security (data leak) | High | `src/app/api/projects/[id]/route.ts:28–30` | Yes |
| 4 | UI validation | Medium–High | `src/app/projects/[id]/page.tsx:96–138`, `src/components/TaskDetail.tsx:47–55,132–154` | No |
