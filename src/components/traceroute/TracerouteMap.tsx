"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapRenderer, TracerouteMapOptions, TraceroutePoint } from "@/lib/map/renderers/MapRenderer";

type TracerouteMapProps = {
  points: TraceroutePoint[];
  visibleCount: number;
  followZoom: number;
  flyToHop: boolean;
  revealDelayMs: number;
};

export default function TracerouteMap({
  points,
  visibleCount,
  followZoom,
  flyToHop,
  revealDelayMs,
}: TracerouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const [isReady, setIsReady] = useState(false);

  const options: TracerouteMapOptions = useMemo(
    () => ({
      followZoom,
      flyToHop,
      revealDelayMs,
    }),
    [followZoom, flyToHop, revealDelayMs]
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Load Cesium on the client only to avoid SSR crashes.
      const mod = await import("@/lib/map/renderers/CesiumRenderer");
      if (cancelled) return;
      const renderer = new mod.CesiumRenderer();
      rendererRef.current = renderer;
      if (containerRef.current) {
        renderer.init(containerRef.current);
      }
      setIsReady(true);
    }

    boot();

    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !rendererRef.current) return;
    rendererRef.current.setData(points, options);
  }, [isReady, points, options]);

  useEffect(() => {
    if (!isReady || !rendererRef.current) return;
    rendererRef.current.revealHop(visibleCount);
  }, [isReady, visibleCount, points.length]);

  useEffect(() => {
    if (!isReady || !rendererRef.current) return;
    if (!flyToHop) return;
    if (visibleCount < 1) return;
    rendererRef.current.focusHop(visibleCount - 1);
  }, [isReady, flyToHop, visibleCount, options]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute left-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <button
          type="button"
          onClick={() => rendererRef.current?.zoomIn?.()}
          className="h-9 w-9 border-b text-lg leading-none text-zinc-700 hover:bg-zinc-50"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => rendererRef.current?.zoomOut?.()}
          className="h-9 w-9 text-lg leading-none text-zinc-700 hover:bg-zinc-50"
          aria-label="Zoom out"
        >
          -
        </button>
      </div>
    </div>
  );
}
