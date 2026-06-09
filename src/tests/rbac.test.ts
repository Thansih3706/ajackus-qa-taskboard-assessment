// @vitest-environment node
// Reference answer for Part 2 — DO NOT SHIP to candidates
// Shows the fixed version of part2.test.ts plus the added fourth test.
// Requires the dev server running on http://localhost:3000

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const data = (await res.json()) as { token: string };
  return data.token;
}

let tokens: { meera: string; arjun: string; dev: string; lina: string };
let taskId: string;

beforeAll(async () => {
  const [meera, arjun, dev, lina] = await Promise.all([
    login("meera@taskboard.dev"),
    login("arjun@taskboard.dev"),
    login("dev@example.com"),
    login("lina@example.com"),
  ]);
  tokens = { meera, arjun, dev, lina };

  const projectsRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${meera}` },
  });
  const { projects } = (await projectsRes.json()) as {
    projects: { id: string; name: string }[];
  };
  const projectId = projects.find((p) => p.name === "Q3 Launch")!.id;

  const tasksRes = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks`, {
    headers: { Authorization: `Bearer ${meera}` },
  });
  const { tasks } = (await tasksRes.json()) as { tasks: { id: string }[] };
  taskId = tasks[0].id;
});

describe("Bug 1 — task modification access control", () => {
  // Test A — fixed: assertion changed from not.toBe(500) to toBe(403).
  // not.toBe(500) accepted any non-crash response including 200 — proved nothing.
  it("a user outside the project cannot modify a task", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.lina}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "should be blocked" }),
    });
    expect(res.status).toBe(403);
  });

  // Test B — fixed: subject changed from arjun (member) to dev (viewer).
  // Arjun is a member of Q3 Launch and should succeed — testing his access
  // was verifying correct behavior, not demonstrating a bug. A viewer is a
  // project member with restricted role, and the missing gate lets them edit too.
  it("only members of a project can update its tasks", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.dev}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "should be blocked" }),
    });
    expect(res.status).toBe(403);
  });

  // Test C — unchanged: was the only valid bug proof in the starter file.
  it("a non-member receives 403 when attempting to update a task", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.lina}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "IDOR — non-member should be blocked" }),
    });
    expect(res.status).toBe(403);
  });

  // Test D — added: confirms the fix does not regress legitimate member access.
  it("a project member can still update a task after the fix", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.arjun}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "updated by member — baseline" }),
    });
    expect(res.status).toBe(200);
  });
});
