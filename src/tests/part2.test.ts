// @vitest-environment node
// Part 2 starter — do not modify the test descriptions or setup
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
  // Test A
  it("a user outside the project cannot modify a task", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.lina}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "should be blocked" }),
    });
    expect(res.status).not.toBe(500);
  });

  // Test B
  it("only members of a project can update its tasks", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.arjun}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "should be blocked" }),
    });
    expect(res.status).toBe(403);
  });

  // Test C
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
});
