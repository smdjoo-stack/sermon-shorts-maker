// Tiny in-memory job queue. Heavy work runs in the background; the client polls.
// Survives only within the running server process (fine for local; swap for a
// real queue when deploying).
//
// The Map lives on globalThis: Next.js bundles each route separately, so a
// plain module-level Map gives each route its OWN instance — a job created by
// /api/render would then be invisible to /api/jobs (404). Dev HMR reloads have
// the same effect. globalThis is the one thing they all share.

import { randomUUID } from "node:crypto";
import type { Job, JobKind } from "./types";

const globalForJobs = globalThis as unknown as { __shortsJobs?: Map<string, Job> };
const jobs: Map<string, Job> = (globalForJobs.__shortsJobs ??= new Map<string, Job>());

// keep memory bounded
const MAX_JOBS = 200;

export function createJob(kind: JobKind): Job {
  const job: Job = {
    id: randomUUID(),
    kind,
    status: "queued",
    progress: 0,
    message: "대기 중...",
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  if (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) jobs.delete(oldest.id);
  }
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const j = jobs.get(id);
  if (j) Object.assign(j, patch);
}

// Run an async task tied to a job, updating status/progress/result.
export function runJob<T>(
  job: Job,
  task: (progress: (p: number, msg?: string) => void) => Promise<T>,
): void {
  updateJob(job.id, { status: "running", message: "시작 중..." });
  const progress = (p: number, msg?: string) => {
    updateJob(job.id, { progress: Math.max(0, Math.min(1, p)), ...(msg ? { message: msg } : {}) });
  };
  task(progress)
    .then((result) => {
      updateJob(job.id, { status: "done", progress: 1, message: "완료", result });
    })
    .catch((err) => {
      const msg = String(err?.message || err);
      updateJob(job.id, { status: "error", error: msg, message: "오류: " + msg.slice(0, 200) });
    });
}
