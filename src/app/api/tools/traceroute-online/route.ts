import { NextResponse } from "next/server";
import { z } from "zod";
import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import net from "node:net";
import ipaddr from "ipaddr.js";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import {
    createJob,
    finalizeJob,
    type HopRecord,
    type JobResult,
    type StopReason,
} from "./store";

export const runtime = "nodejs"; // // ✅ needs Node + traceroute binary

const BodySchema = z.object({
    target: z.string().trim().min(1).max(253),
    jobId: z.string().trim().optional(),
});

const DEFAULT_MAX_HOPS = 10;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_NO_REPLY_STREAK = 3;

function isIp(value: string) {
    return net.isIP(value) !== 0;
}

function isPublicIp(ip: string) {
    // // ✅ Only public routable addresses (skip private/loopback/link-local/etc.)
    try {
        const parsed = ipaddr.parse(ip);
        return parsed.range() === "unicast";
    } catch {
        return false;
    }
}

function parseMs(value: string): number | null {
    const m = value.match(/(\d+(\.\d+)?)\s*ms/i);
    if (!m) return null;
    return Number(m[1]);
}

function hopRttMs(rtt: [string, string, string]): number | null {
    const candidates = rtt
        .map(parseMs)
        .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));

    if (!candidates.length) return null;
    return Math.min(...candidates);
}

function parseTracerouteLine(line: string): HopRecord | null {
    // // Skip header like: "traceroute to ..."
    if (line.toLowerCase().startsWith("traceroute")) return null;

    const m = line.match(/^(\d+)\s+(.*)$/);
    if (!m) return null;

    const hopNum = Number(m[1]);
    const rest = m[2];
    const tokens = rest.split(/\s+/);

    const firstIpIdx = tokens.findIndex((t) => isIp(t.replace(/[()]/g, "")));
    const ip = firstIpIdx >= 0 ? tokens[firstIpIdx].replace(/[()]/g, "") : null;

    const rttCells: string[] = [];
    for (let i = Math.max(firstIpIdx + 1, 0); i < tokens.length && rttCells.length < 3; i++) {
        const t = tokens[i];

        if (t === "*") {
            rttCells.push("*");
            continue;
        }

        const cleaned = t.replace(/[()]/g, "");
        if (isIp(cleaned)) {
            rttCells.push(cleaned);
            continue;
        }

        const next = tokens[i + 1];
        if (/^\d+(\.\d+)?$/.test(t) && next && next.startsWith("ms")) {
            rttCells.push(`${t} ms`);
            i += 1; // // skip "ms"
            continue;
        }
    }

    while (rttCells.length < 3) rttCells.push("");

    const rtt = [rttCells[0], rttCells[1], rttCells[2]] as [string, string, string];
    const rttMs = hopRttMs(rtt);
    const isNoReply = !ip && rest.includes("*");

    return {
        hop: hopNum,
        ip,
        rtt,
        rttMs,
        geo: null,
        rawLine: line,
        status: ip ? "ok" : "unknown",
        isNoReply,
    };
}

async function geoLookup(ip: string) {
    const headers = {
        "user-agent": "SecWeave/1.0 (traceroute tool)",
        accept: "application/json",
    };

    // // 1) ipwho.is
    try {
        const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
            cache: "no-store",
            headers,
        });
        if (res.ok) {
            const j: any = await res.json();
            if (j?.success && typeof j.latitude === "number" && typeof j.longitude === "number") {
                return {
                    lat: j.latitude,
                    lon: j.longitude,
                    city: j.city,
                    country: j.country,
                    isp: j.isp,
                    asn: j.asn,
                };
            }
        }
    } catch {}

    // // 2) ipapi.co fallback
    try {
        const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
            cache: "no-store",
            headers,
        });
        if (res.ok) {
            const j: any = await res.json();
            if (typeof j.latitude === "number" && typeof j.longitude === "number") {
                return {
                    lat: j.latitude,
                    lon: j.longitude,
                    city: j.city,
                    country: j.country_name,
                    isp: j.org,
                    asn: j.asn,
                };
            }
        }
    } catch {}

    return null;
}

export async function POST(req: Request) {
    try {
        const body = BodySchema.parse(await req.json());

        // // Resolve domain -> IP
        let targetIp = body.target;

        if (!isIp(targetIp)) {
            const resolved = await dns.lookup(body.target, { all: true });

            if (!resolved?.length) {
                return NextResponse.json({ error: "Could not resolve domain." }, { status: 400 });
            }

            // // Prefer IPv4 first (like most online tools)
            targetIp = resolved.find((r) => r.family === 4)?.address ?? resolved[0].address;
        }

        // // Block private targets (SSRF-ish)
        if (!isPublicIp(targetIp)) {
            return NextResponse.json(
                { error: "Refusing to trace private / non-public targets." },
                { status: 400 }
            );
        }

        const jobId = body.jobId ?? randomUUID();
        const job = createJob(jobId, body.target, targetIp);

        const ipFamily = net.isIP(targetIp); // // 4 or 6
        const isDarwin = process.platform === "darwin";

        // // ✅ Darwin traceroute does NOT support -4/-6 (your error).
        // // If IPv6 on Darwin, prefer traceroute6 if available.
        const tracerouteBin = ipFamily === 6 && isDarwin ? "traceroute6" : "traceroute";

        const args: string[] = [];
        args.push("-n"); // // no DNS (faster, shows IPs)
        args.push("-q", "1"); // // 1 probe to avoid long star streaks
        args.push("-w", "1"); // // 1s wait per probe
        args.push("-m", String(DEFAULT_MAX_HOPS)); // // max hops
        args.push(targetIp);

        let stopReason: StopReason | null = null;
        let errorMessage: string | undefined;
        let noReplyStreak = 0;
        let stopped = false;
        let killTimer: NodeJS.Timeout | null = null;

        const child = spawn(tracerouteBin, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });
        job.process = child;

        const timeoutId = setTimeout(() => {
            // // Stop on timeout to return partial results.
            stop("TIMEOUT");
        }, DEFAULT_TIMEOUT_MS);

        req.signal.addEventListener("abort", () => {
            // // Client cancelled: terminate traceroute immediately.
            stop("USER_CANCELLED");
        });

        function stop(reason: StopReason, message?: string) {
            if (stopped) return;
            stopped = true;
            stopReason = reason;
            if (message) errorMessage = message;
            if (!child.killed) {
                child.kill("SIGTERM");
                killTimer = setTimeout(() => {
                    if (!child.killed) child.kill("SIGKILL");
                }, 500);
            }
        }
        job.cancel = stop;

        child.on("error", (err) => {
            // // Capture spawn failures (missing traceroute binary, etc.).
            stop("ERROR", err?.message ?? "Failed to start traceroute.");
        });

        const rl = readline.createInterface({
            input: child.stdout,
            crlfDelay: Infinity,
        });

        rl.on("line", (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const hop = parseTracerouteLine(trimmed);
            if (!hop) return;

            job.hops.push(hop);

            if (hop.isNoReply) {
                noReplyStreak += 1;
            } else {
                noReplyStreak = 0;
            }

            if (noReplyStreak >= DEFAULT_NO_REPLY_STREAK) {
                // // Stop when too many hops return only "*" (no reply).
                stop("NO_REPLY_STREAK");
            }
        });

        child.stderr.on("data", (chunk) => {
            const msg = chunk.toString().trim();
            if (msg) {
                errorMessage = msg;
            }
        });

        const exitCode: number = await new Promise((resolve) => {
            child.on("close", (code) => resolve(code ?? 0));
        });

        rl.close();
        clearTimeout(timeoutId);
        if (killTimer) clearTimeout(killTimer);

        if (!stopReason) {
            stopReason = exitCode === 0 ? "COMPLETED" : "ERROR";
        }

        // // Geo lookup for each hop (public hops only).
        for (const hop of job.hops) {
            if (!hop.ip) continue;

            if (!isPublicIp(hop.ip)) {
                hop.geo = null;
                continue;
            }

            try {
                hop.geo = await geoLookup(hop.ip);
            } catch {
                hop.geo = null;
            }
        }

        const result: JobResult = {
            target: body.target,
            targetIp,
            hops: job.hops,
            stopReason,
            errorMessage,
            jobId,
        };

        finalizeJob(job, result);
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "Unknown error" },
            { status: 500 }
        );
    }
}
