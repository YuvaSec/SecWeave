import { NextResponse } from "next/server";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dns from "node:dns/promises";
import net from "node:net";
import ipaddr from "ipaddr.js";

export const runtime = "nodejs"; // // ✅ needs Node + traceroute binary

const execFileAsync = promisify(execFile);

const BodySchema = z.object({
    target: z.string().trim().min(1).max(253),
});

type Hop = {
    hop: number;
    ip: string | null; // // "IP ADDRESS / HOST"
    rtt: [string, string, string]; // // "RTT 1/2/3"
    geo: null | {
        lat: number;
        lon: number;
        city?: string;
        country?: string;
        isp?: string;
        asn?: string;
    };
};

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

function parseTraceroute(stdout: string): Hop[] {
    const lines = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    const hops: Hop[] = [];

    for (const line of lines) {
        // // Skip header like: "traceroute to ..."
        if (line.toLowerCase().startsWith("traceroute")) continue;

        const m = line.match(/^(\d+)\s+(.*)$/);
        if (!m) continue;

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
                rttCells.push(cleaned); // // sometimes shows IP in RTT columns (load balancing)
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

        hops.push({
            hop: hopNum,
            ip,
            rtt: [rttCells[0], rttCells[1], rttCells[2]] as [string, string, string],
            geo: null,
        });
    }

    return hops;
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

        const ipFamily = net.isIP(targetIp); // // 4 or 6
        const isDarwin = process.platform === "darwin";

        // // ✅ Darwin traceroute does NOT support -4/-6 (your error).
        // // If IPv6 on Darwin, prefer traceroute6 if available.
        const tracerouteBin = ipFamily === 6 && isDarwin ? "traceroute6" : "traceroute";

        const args: string[] = [];
        args.push("-n"); // // no DNS (faster, shows IPs)
        args.push("-q", "3"); // // 3 probes => RTT 1/2/3
        args.push("-w", "1"); // // 1s wait per probe
        args.push("-m", "30"); // // max hops
        args.push(targetIp);

        let stdout = "";
        try {
            const result = await execFileAsync(tracerouteBin, args, {
                timeout: 60_000,
                maxBuffer: 1024 * 1024,
            });
            stdout = result.stdout;
        } catch (err: any) {
            // // If traceroute6 isn't installed on mac, retry with traceroute
            if (tracerouteBin === "traceroute6") {
                const result = await execFileAsync("traceroute", args, {
                    timeout: 60_000,
                    maxBuffer: 1024 * 1024,
                });
                stdout = result.stdout;
            } else {
                throw err;
            }
        }

        const hops = parseTraceroute(stdout);

        // // Geo lookup for each hop (public hops only)
        for (const hop of hops) {
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

        return NextResponse.json({
            target: body.target,
            targetIp,
            hops,
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "Unknown error" },
            { status: 500 }
        );
    }
}
