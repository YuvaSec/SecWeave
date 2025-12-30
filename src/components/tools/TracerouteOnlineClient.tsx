"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import AnimatedRoute from "@/components/tools/traceroute/AnimatedRoute";

// // ✅ Fix Leaflet default marker icon paths in Next.js
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

// // ✅ Pulsing DivIcon for the "current hop"
// // NOTE: Requires CSS in globals.css for `.leaflet-pulse-icon` + `.pulse-*`
const currentHopPulseIcon = L.divIcon({
  className: "leaflet-pulse-icon",
  html: `<div class="pulse-wrap"><div class="pulse-ring"></div><div class="pulse-dot"></div></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// // React-Leaflet must be dynamically imported (avoid SSR/window issues)
const MapContainer = dynamic(
    () => import("react-leaflet").then((m) => m.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });

type Hop = {
  hop: number;
  ip: string | null;
  rtt: [string, string, string];
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
};

type Point = {
  hop: number;
  ip: string;
  lat: number;
  lon: number;
  label: string;
  isp?: string;
  asn?: string;
  rtt: [string, string, string];
};

function parseMs(value: string): number | null {
  // // Extract "12.3 ms" -> 12.3
  const m = value.match(/(\d+(\.\d+)?)\s*ms/i);
  if (!m) return null;
  return Number(m[1]);
}

function hopRttMs(rtt: [string, string, string]): number | null {
  // // Use the best (minimum) RTT among the 3 probes
  const candidates = rtt
      .map(parseMs)
      .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));

  if (!candidates.length) return null;
  return Math.min(...candidates);
}

function colorForRtt(ms: number | null): string {
  // // RTT color buckets (tweak if you want)
  if (ms === null) return "#94a3b8"; // slate/unknown
  if (ms < 30) return "#22c55e"; // green
  if (ms < 80) return "#84cc16"; // lime
  if (ms < 150) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export default function TracerouteOnlineClient() {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // // Animation controls
  const [isPlaying, setIsPlaying] = useState(true);

  // // ✅ DEFAULT #1: Follow hops enabled by default
  const [flyToHop, setFlyToHop] = useState(true);

  const [visibleCount, setVisibleCount] = useState(0);

  // // ✅ DEFAULT #2: Speed 1.2s (ms per hop)
  const [revealDelayMs, setRevealDelayMs] = useState(1200);

  // // ✅ DEFAULT #3: Zoom "4"
  const [followZoom, setFollowZoom] = useState(5);

  // // Leaflet map instance (so we can flyTo/panTo)
  const mapRef = useRef<any>(null);

  // // Make Leaflet available globally for some plugins (safety)
  useEffect(() => {
    (window as any).L = L;
  }, []);

  const points: Point[] = useMemo(() => {
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

  const visiblePoints = useMemo(() => points.slice(0, visibleCount), [points, visibleCount]);

  // // Build RTT-colored segments for visible points (hop-by-hop growth)
  const rttSegments = useMemo(() => {
    if (visiblePoints.length < 2) return [];

    const segs: Array<{
      key: string;
      from: [number, number];
      to: [number, number];
      color: string;
      ms: number | null;
    }> = [];

    for (let i = 1; i < visiblePoints.length; i++) {
      const a = visiblePoints[i - 1];
      const b = visiblePoints[i];

      // // Use destination hop RTT as segment RTT (feels intuitive)
      const ms = hopRttMs(b.rtt);

      segs.push({
        key: `${a.hop}-${b.hop}`,
        from: [a.lat, a.lon],
        to: [b.lat, b.lon],
        color: colorForRtt(ms),
        ms,
      });
    }

    return segs;
  }, [visiblePoints]);

  // // Current hop (for highlight + camera)
  const currentPoint = useMemo(() => {
    if (!visiblePoints.length) return null;
    return visiblePoints[visiblePoints.length - 1];
  }, [visiblePoints]);

  // // When new results arrive, start reveal from hop 1
  useEffect(() => {
    if (!points.length) {
      setVisibleCount(0);
      return;
    }

    setVisibleCount(1);
    setIsPlaying(true);

    // // ✅ Jump closer at the start so the travel looks intentional
    const map = mapRef.current;
    const first = points[0];
    if (map && first) {
      map.setView([first.lat, first.lon], followZoom, { animate: false });
    }
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

  // // ✅ Travel camera: panTo when already zoomed in (feels like dragging),
  // // otherwise flyTo to zoom in smoothly.
  useEffect(() => {
    if (!flyToHop) return;
    if (!currentPoint) return;

    const map = mapRef.current;
    if (!map) return;

    // // duration tied to speed (bounded)
    const duration = Math.min(1.4, Math.max(0.6, revealDelayMs / 1000));
    const currentZoom = map.getZoom();

    if (currentZoom >= followZoom) {
      map.panTo([currentPoint.lat, currentPoint.lon], { animate: true, duration });
    } else {
      map.flyTo([currentPoint.lat, currentPoint.lon], followZoom, { duration });
    }
  }, [flyToHop, currentPoint, followZoom, revealDelayMs]);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/tools/traceroute-online", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Request failed");

      setData(j);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const completed = points.length >= 2 && visibleCount >= points.length;

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
          {points.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="rounded-lg border px-3 py-1.5 hover:bg-zinc-50"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>

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

                <label className="flex items-center gap-2 select-none">
                  <input
                      type="checkbox"
                      checked={flyToHop}
                      onChange={(e) => setFlyToHop(e.target.checked)}
                  />
                  Follow hops
                </label>

                {/* Speed selector */}
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

                {/* Zoom control */}
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
                  <span className="font-medium text-zinc-900">{Math.min(visibleCount, points.length)}</span> /{" "}
                  <span className="font-medium text-zinc-900">{points.length}</span>
                </div>
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

              {/* Map */}
              <div className="mt-4 overflow-hidden rounded-2xl border">
                <div className="h-[360px] w-full">
                  <MapContainer
                      center={[20, 0]}
                      zoom={2}
                      scrollWheelZoom={true}
                      dragging={true}
                      touchZoom={true}
                      doubleClickZoom={true}
                      zoomControl={true}
                      className="h-full w-full"
                      ref={(map: any) => {
                        // // ✅ React-Leaflet v4/v5: ref callback gives the map instance
                        mapRef.current = map;
                      }}
                  >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    {/* RTT-colored segments during reveal */}
                    {rttSegments.map((s) => (
                        <Polyline
                            key={s.key}
                            positions={[s.from, s.to]}
                            pathOptions={{
                              color: s.color,
                              weight: 4,
                              opacity: 0.85,
                            }}
                        />
                    ))}

                    {/* Completed-route animation AFTER reveal */}
                    {completed ? (
                        <AnimatedRoute positions={points.map((p) => [p.lat, p.lon] as [number, number])} />
                    ) : null}

                    {/* Current hop pulsing marker */}
                    {currentPoint ? (
                        <Marker
                            position={[currentPoint.lat, currentPoint.lon]}
                            icon={currentHopPulseIcon}
                            interactive={false}
                        />
                    ) : null}

                    {/* Markers appear hop-by-hop */}
                    {visiblePoints.map((p) => (
                        <Marker key={`${p.hop}-${p.ip}`} position={[p.lat, p.lon]}>
                          <Popup>
                            <div className="text-sm">
                              <div className="font-semibold">Hop {p.hop}</div>
                              <div className="text-zinc-700">{p.ip}</div>
                              {p.label ? <div className="text-zinc-600">{p.label}</div> : null}
                              {p.asn ? <div className="text-zinc-600">{p.asn}</div> : null}
                              {p.isp ? <div className="text-zinc-600">{p.isp}</div> : null}

                              <div className="mt-2 text-zinc-600">
                                RTT best:{" "}
                                <span className="font-medium text-zinc-900">
                            {(() => {
                              const ms = hopRttMs(p.rtt);
                              return ms === null ? "N/A" : `${ms.toFixed(1)} ms`;
                            })()}
                          </span>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                    ))}
                  </MapContainer>
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
            </div>
        ) : null}
      </div>
  );
}
