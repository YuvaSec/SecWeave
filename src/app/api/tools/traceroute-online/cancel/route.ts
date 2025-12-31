import { NextResponse } from "next/server";
import { z } from "zod";
import { getJob } from "../store";

const BodySchema = z.object({
  jobId: z.string().trim().min(1),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const job = getJob(body.jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (job.cancel) {
      // // Ensure the running request marks the stop reason as user-cancelled.
      job.cancel("USER_CANCELLED");
    }

    if (job.process && !job.process.killed) {
      job.process.kill("SIGTERM");
      setTimeout(() => {
        if (job.process && !job.process.killed) {
          job.process.kill("SIGKILL");
        }
      }, 500);
    }

    // // Await completion so we can return partial results + stop reason.
    const result = await job.donePromise;
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
