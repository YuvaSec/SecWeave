"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TracerouteMap from "@/components/traceroute/TracerouteMap";
import HopTable from "@/components/traceroute/HopTable";
import type { TraceroutePoint } from "@/lib/map/renderers/MapRenderer";

type Hop = {
  hop: number;
  ip: string | null;
  host?: string | null;
  rtt: [string, string, string];
  rttMs?: number | null;
  status?: "ok" | "unknown";
  isNoReply?: boolean;
  geo: null | {
    lat: number;
    lon: number;
    city?: string;
    country?: string;
    isp?: string;
    asn?: string;
  };
};

type ApiResponse = {
  target: string;
  targetIp: string;
  hops: Hop[];
  stopReason?: "TIMEOUT" | "NO_REPLY_STREAK" | "USER_CANCELLED" | "COMPLETED" | "ERROR";
  errorMessage?: string;
  jobId?: string;
};

export default function TracerouteOnlineClient() {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState<ApiResponse["stopReason"] | null>(null);
  const [stopMessage, setStopMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [activeHopIndex, setActiveHopIndex] = useState<number | null>(null);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // // Animation controls
  const [isPlaying, setIsPlaying] = useState(true);

  // // ✅ DEFAULT #1: Follow hops enabled by default
  const [flyToHop, setFlyToHop] = useState(true);

  const [visibleCount, setVisibleCount] = useState(0);

  // // ✅ DEFAULT #2: Speed 1.2s (ms per hop)
  const [revealDelayMs, setRevealDelayMs] = useState(1200);

  // // ✅ DEFAULT #3: Zoom "4"
  const [followZoom, setFollowZoom] = useState(6);

  const points: TraceroutePoint[] = useMemo(() => {
    if (!data) return [];

    return data.hops
        .filter((h) => h.geo && h.ip)
        .map((h) => ({
          hop: h.hop,
          ip: h.ip!,
          lat: h.geo!.lat,
          lon: h.geo!.lon,
          label: `${h.geo!.city ?? ""}${h.geo!.city ? ", " : ""}${h.geo!.country ?? ""}`.trim(),
          isp: h.geo!.isp,
          asn: h.geo!.asn,
          rtt: h.rtt,
        }));
  }, [data]);

  useEffect(() => {
    if (!data?.hops?.length) {
      setActiveHopIndex(null);
      setActivePointIndex(null);
      return;
    }
    if (activeHopIndex === null) return;
    const hop = data.hops[activeHopIndex];
    if (!hop) return;
    const pointIndex = points.findIndex((p) => p.hop === hop.hop);
    setActivePointIndex(pointIndex >= 0 ? pointIndex : null);
  }, [activeHopIndex, data, points]);

  // // When new results arrive, start reveal from hop 1
  useEffect(() => {
    if (!points.length) {
      setVisibleCount(0);
      return;
    }

    setVisibleCount(1);
    setIsPlaying(true);

  }, [points.length, followZoom]);

  // // Hop-by-hop reveal timer (uses speed selector)
  useEffect(() => {
    if (!points.length) return;
    if (!isPlaying) return;
    if (visibleCount >= points.length) return;

    const id = window.setInterval(() => {
      setVisibleCount((c) => Math.min(c + 1, points.length));
    }, revealDelayMs);

    return () => window.clearInterval(id);
  }, [isPlaying, visibleCount, points.length, revealDelayMs]);

  function createJobId(): string {
    // Older browsers may not support crypto.randomUUID.
    if (typeof window !== "undefined" && "crypto" in window && "randomUUID" in window.crypto) {
      return window.crypto.randomUUID();
    }
    return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    setStopReason(null);
    setStopMessage(null);
    setActiveHopIndex(null);
    setActivePointIndex(null);

    try {
      const jobId = createJobId();
      jobIdRef.current = jobId;
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/tools/traceroute-online", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, jobId }),
        signal: controller.signal,
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Request failed");

      setData(j);
      setStopReason(j.stopReason ?? "COMPLETED");
      setStopMessage(j.errorMessage ?? null);
    } catch (e: any) {
      if (abortRef.current?.signal.aborted) {
        return;
      }
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
      abortRef.current = null;
      jobIdRef.current = null;
    }
  }

  async function stopTrace() {
    const jobId = jobIdRef.current;
    if (!jobId) return;

    abortRef.current?.abort();

    try {
      const res = await fetch("/api/tools/traceroute-online/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Cancel failed");

      setData(j);
      setStopReason(j.stopReason ?? "USER_CANCELLED");
      setStopMessage(j.errorMessage ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
      jobIdRef.current = null;
    }
  }

  const shouldShowStopBanner = Boolean(stopReason && stopReason !== "COMPLETED");
  const stopBannerText = (() => {
    switch (stopReason) {
      case "TIMEOUT":
        return "Stopped (timeout). Showing partial results.";
      case "NO_REPLY_STREAK":
        return "Stopped (no reply from hops). Showing partial results.";
      case "USER_CANCELLED":
        return "Stopped by user. Showing partial results.";
      case "ERROR":
        return stopMessage
          ? `Stopped with error: ${stopMessage}`
          : "Stopped with error. Showing partial results.";
      default:
        return null;
    }
  })();

  return (
      <div className="space-y-6">
        {/* Input */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-zinc-800">Domain or IP Address</label>

          <div className="mt-2 flex gap-2">
            <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="example.com or 8.8.8.8"
                className="h-11 w-full rounded-xl border px-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <button
              onClick={run}
              disabled={loading || !target.trim()}
              className="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Tracing... (may take a minute)" : "Start Traceroute"}
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          {/* Playback controls */}
          {points.length || loading ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {points.length ? (
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="rounded-lg border px-3 py-1.5 hover:bg-zinc-50"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                ) : null}

                {loading ? (
                  <button
                    type="button"
                    onClick={stopTrace}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                  >
                    Stop
                  </button>
                ) : null}

                {points.length ? (
                <button
                    type="button"
                    onClick={() => {
                      setVisibleCount(points.length ? 1 : 0);
                      setIsPlaying(true);
                    }}
                    className="rounded-lg border px-3 py-1.5 hover:bg-zinc-50"
                >
                  Replay
                </button>
                ) : null}

                {points.length ? (
                <label className="flex items-center gap-2 select-none">
                  <input
                      type="checkbox"
                      checked={flyToHop}
                      onChange={(e) => setFlyToHop(e.target.checked)}
                  />
                  Follow hops
                </label>
                ) : null}

                {points.length ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600">Speed:</span>

                      <button
                        type="button"
                        onClick={() => setRevealDelayMs(300)}
                        className={`rounded-lg border px-3 py-1.5 hover:bg-zinc-50 ${
                          revealDelayMs === 300 ? "bg-zinc-100" : ""
                        }`}
                      >
                        0.3s
                      </button>

                      <button
                        type="button"
                        onClick={() => setRevealDelayMs(700)}
                        className={`rounded-lg border px-3 py-1.5 hover:bg-zinc-50 ${
                          revealDelayMs === 700 ? "bg-zinc-100" : ""
                        }`}
                      >
                        0.7s
                      </button>

                      <button
                        type="button"
                        onClick={() => setRevealDelayMs(1200)}
                        className={`rounded-lg border px-3 py-1.5 hover:bg-zinc-50 ${
                          revealDelayMs === 1200 ? "bg-zinc-100" : ""
                        }`}
                      >
                        1.2s
                      </button>
                    </div>

                    <label className="flex items-center gap-2 select-none">
                      <span className="text-zinc-600">Zoom:</span>
                      <select
                        className="rounded-lg border px-2 py-1.5"
                        value={followZoom}
                        onChange={(e) => setFollowZoom(Number(e.target.value))}
                      >
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                        <option value={6}>6</option>
                      </select>
                    </label>

                    <div className="text-zinc-600">
                      Showing hops:{" "}
                      <span className="font-medium text-zinc-900">
                        {Math.min(visibleCount, points.length)}
                      </span>{" "}
                      / <span className="font-medium text-zinc-900">{points.length}</span>
                    </div>
                  </>
                ) : null}
              </div>
          ) : null}
        </div>

        {/* Results */}
        {data ? (
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold text-zinc-900">Traceroute Results</h3>
                <p className="text-sm text-zinc-600">
                  Target: <span className="font-medium text-zinc-900">{data.target}</span> ({data.targetIp})
                </p>
              </div>

              {shouldShowStopBanner && stopBannerText ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {stopBannerText}
                </div>
              ) : null}

              {/* Map */}
              <div className="mt-4 overflow-hidden rounded-2xl border">
                <div className="h-[360px] w-full">
                  <TracerouteMap
                    points={points}
                    visibleCount={visibleCount}
                    followZoom={followZoom}
                    flyToHop={flyToHop}
                    revealDelayMs={revealDelayMs}
                    activeHopIndex={activePointIndex}
                  />
                </div>
              </div>

              {/* Legend */}
              {points.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-6 rounded" style={{ background: "#22c55e" }} /> fast
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-6 rounded" style={{ background: "#84cc16" }} /> ok
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-6 rounded" style={{ background: "#f59e0b" }} /> slow
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-6 rounded" style={{ background: "#ef4444" }} /> very slow
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-6 rounded" style={{ background: "#94a3b8" }} /> unknown
                  </span>
                </div>
              ) : null}

              {data?.hops?.length ? (
                <HopTable
                  hops={data.hops}
                  activeHopIndex={activeHopIndex}
                  onSelectHop={setActiveHopIndex}
                />
              ) : null}
            </div>
        ) : null}
      </div>
  );
}
