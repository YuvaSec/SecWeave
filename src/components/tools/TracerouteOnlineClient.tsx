"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { FieldHint, FieldLabel, TextField } from "@/components/ui/fields";
import AnimatedRoute from "@/components/tools/traceroute/AnimatedRoute";
import L from "leaflet";

// // ✅ Fix Leaflet default marker icon paths in Next.js
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});


const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});

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

type MapPoint = {
  hop: number;
  ip: string;
  lat: number;
  lon: number;
  label: string;
  isp?: string;
  asn?: string;
};

export default function TracerouteOnlineClient() {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const points = useMemo<MapPoint[]>(() => {
    if (!data) return [];

    return data.hops.flatMap((hop) => {
      if (!hop.geo || !hop.ip) return [];

      const label = [hop.geo.city, hop.geo.country].filter(Boolean).join(", ");
      return [
        {
          hop: hop.hop,
          ip: hop.ip,
          lat: hop.geo.lat,
          lon: hop.geo.lon,
          label,
          isp: hop.geo.isp,
          asn: hop.geo.asn,
        },
      ];
    });
  }, [data]);

  const polyline = useMemo(
    () => points.map((point) => [point.lat, point.lon] as [number, number]),
    [points],
  );

  async function run() {
    const trimmed = target.trim();
    if (!trimmed) {
      setError("Enter a domain or IP address.");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/tools/traceroute-online", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: trimmed }),
      });

      const payload = (await res.json()) as ApiResponse | { error?: string };

      if (!res.ok) {
        const message =
          "error" in payload && payload.error
            ? payload.error
            : "Request failed";
        throw new Error(message);
      }

      if (!("hops" in payload)) {
        throw new Error("Unexpected response format");
      }

      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-panel p-5 shadow-soft">
        <div className="space-y-2">
          <FieldLabel>Domain or IP address</FieldLabel>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <TextField
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="example.com or 8.8.8.8"
              aria-label="Domain or IP address"
            />
            <Button
              type="button"
              onClick={run}
              disabled={loading || !target.trim()}
              className="md:shrink-0"
            >
              {loading ? "Tracing route..." : "Start traceroute"}
            </Button>
          </div>
          <FieldHint>Traceroutes can take up to a minute to complete.</FieldHint>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      {data ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-5 shadow-soft">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-fg">
                Traceroute results
              </h3>
              <p className="text-sm text-muted">
                Target: <span className="font-medium text-fg">{data.target}</span>
                {" "}
                ({data.targetIp})
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="h-[360px] w-full">
                <MapContainer
                  center={[20, 0]}
                  zoom={2}
                  scrollWheelZoom={false}
                  className="h-full w-full"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {polyline.length >= 2 ? <AnimatedRoute positions={polyline} /> : null}

                  {points.map((point) => (
                    <Marker
                      key={`${point.hop}-${point.ip}`}
                      position={[point.lat, point.lon]}
                    >
                      <Popup>
                        <div className="text-sm">
                          <div className="font-semibold">Hop {point.hop}</div>
                          <div className="text-muted">{point.ip}</div>
                          {point.label ? (
                            <div className="text-muted">{point.label}</div>
                          ) : null}
                          {point.asn ? (
                            <div className="text-muted">{point.asn}</div>
                          ) : null}
                          {point.isp ? (
                            <div className="text-muted">{point.isp}</div>
                          ) : null}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-5 shadow-soft">
            <h4 className="text-sm font-semibold text-fg">Hops</h4>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="text-muted">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4">Hop</th>
                    <th className="py-2 pr-4">IP address / host</th>
                    <th className="py-2 pr-4">RTT 1</th>
                    <th className="py-2 pr-4">RTT 2</th>
                    <th className="py-2 pr-4">RTT 3</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hops.map((hop) => (
                    <tr key={hop.hop} className="border-b border-border last:border-b-0">
                      <td className="py-2 pr-4 font-medium text-fg">
                        {hop.hop}
                      </td>
                      <td className="py-2 pr-4 text-muted">
                        {hop.ip ?? "*"}
                      </td>
                      <td className="py-2 pr-4 text-muted">{hop.rtt[0] || ""}</td>
                      <td className="py-2 pr-4 text-muted">{hop.rtt[1] || ""}</td>
                      <td className="py-2 pr-4 text-muted">{hop.rtt[2] || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-faint">
              Note: Some RTT cells may show an IP when traceroute returns multiple
              responders for a hop (load balancing).
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
