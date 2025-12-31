import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type StopReason =
  | "TIMEOUT"
  | "NO_REPLY_STREAK"
  | "USER_CANCELLED"
  | "COMPLETED"
  | "ERROR";

export type HopRecord = {
  hop: number;
  ip: string | null;
  rtt: [string, string, string];
  rttMs: number | null;
  geo: null | {
    lat: number;
    lon: number;
    city?: string;
    country?: string;
    isp?: string;
    asn?: string;
  };
  rawLine?: string;
  status: "ok" | "unknown";
  isNoReply: boolean;
};

export type JobResult = {
  target: string;
  targetIp: string;
  hops: HopRecord[];
  stopReason: StopReason;
  errorMessage?: string;
  jobId: string;
};

export type JobState = {
  jobId: string;
  target: string;
  targetIp: string;
  hops: HopRecord[];
  stopReason: StopReason | null;
  errorMessage?: string;
  process?: ChildProcessWithoutNullStreams;
  cancel?: (reason: StopReason) => void;
  donePromise: Promise<JobResult>;
  resolveDone: (result: JobResult) => void;
  cleanupTimer?: NodeJS.Timeout;
};

const jobs = new Map<string, JobState>();

export function createJob(jobId: string, target: string, targetIp: string): JobState {
  let resolveDone!: (result: JobResult) => void;
  const donePromise = new Promise<JobResult>((resolve) => {
    resolveDone = resolve;
  });

  const job: JobState = {
    jobId,
    target,
    targetIp,
    hops: [],
    stopReason: null,
    donePromise,
    resolveDone,
  };

  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string) {
  return jobs.get(jobId) ?? null;
}

export function finalizeJob(job: JobState, result: JobResult) {
  job.stopReason = result.stopReason;
  job.errorMessage = result.errorMessage;
  job.resolveDone(result);

  if (job.cleanupTimer) {
    clearTimeout(job.cleanupTimer);
  }

  // Keep results briefly for cancel polling, then clean up.
  job.cleanupTimer = setTimeout(() => {
    jobs.delete(job.jobId);
  }, 60_000);
}
