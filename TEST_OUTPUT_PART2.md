# TEST_OUTPUT.md

## Part 2 — Test Analysis and Results

### Initial Test Run

Command:

```bash
npm test src/tests/part2.test.ts
```

Result:

```text
FAIL - a viewer cannot update a task
FAIL - a viewer cannot create a task
PASS - a member can create a task
```

---

## Test-by-Test Analysis

### Test A — a viewer cannot update a task

**Purpose**

Validates that a user with the Viewer role cannot update an existing task.

**Expected Result**

HTTP 403 Forbidden

**Actual Result**

HTTP 200 OK

**Analysis**

The test uses a valid Viewer account (`dev@example.com`) and attempts to update a task in the Q3 Launch project.

The API allows the update and returns HTTP 200.

**Conclusion**

* Test is correct.
* Application code is incorrect.
* This is a valid bug proof.

---

### Test B — a viewer cannot create a task

**Purpose**

Validates that a Viewer cannot create a task.

**Expected Result in Test**

HTTP 401 Unauthorized

**Actual Result**

HTTP 403 Forbidden

**Analysis**

The Viewer user is authenticated with a valid JWT token.

HTTP 401 indicates authentication failure, while HTTP 403 indicates authorization failure.

The application correctly returns HTTP 403.

**Conclusion**

* Application code is correct.
* Test assertion is incorrect.
* This is not a product bug.

---

### Test C — a member can create a task

**Purpose**

Validates that a project member can create a task.

**Expected Result**

HTTP 201 Created

**Actual Result**

HTTP 201 Created

**Conclusion**

* Test is correct.
* Application behavior is correct.
* Valid baseline test.

---

## Fix Applied

Updated Test B assertion:

**Before**

```ts
expect(res.status).toBe(401);
```

**After**

```ts
expect(res.status).toBe(403);
```

**Reason**

The user is authenticated but lacks permission. The correct response is HTTP 403 Forbidden.

---

## Additional Test Added

### Test D — a non-member cannot update a task

```ts
it("a non-member cannot update a task", async () => {
  const linaToken = await login("lina@example.com");

  const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${linaToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "non-member update attempt" }),
  });

  expect(res.status).toBe(403);
});
```

**Purpose**

Validates that a user who is not a member of the project cannot update project tasks.

**Expected Result**

HTTP 403 Forbidden

**Actual Result**

HTTP 200 OK

**Conclusion**

* Test is correct.
* Application code is incorrect.
* Valid bug proof.

---

## Final Test Run

Command:

```bash
npm test src/tests/part2.test.ts
```

Result:

```text
FAIL - a viewer cannot update a task
PASS - a viewer cannot create a task
PASS - a member can create a task
FAIL - a non-member cannot update a task
```

---

## Final Assessment

### Invalid Test Fixed

* Viewer create task test expected HTTP 401.
* Corrected to HTTP 403.

### Additional Coverage Added

* Non-member update task authorization test.

### Remaining Failing Tests

The remaining failures are valid bug proofs demonstrating that:

1. Viewer users can update tasks.
2. Non-members can update tasks.

### Root Cause

`PATCH /api/tasks/:id`

File:

```text
src/app/api/tasks/[id]/route.ts
```

The PATCH handler validates authentication but does not validate:

* Project membership
* User role permissions

As a result, authenticated users can modify tasks they should not be able to access.
