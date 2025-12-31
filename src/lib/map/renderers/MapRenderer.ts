export type TraceroutePoint = {
  hop: number;
  ip: string;
  lat: number;
  lon: number;
  label: string;
  isp?: string;
  asn?: string;
  rtt: [string, string, string];
};

export type TracerouteMapOptions = {
  followZoom: number;
  flyToHop: boolean;
  revealDelayMs: number;
};

export interface MapRenderer {
  init(containerEl: HTMLDivElement): void;
  setData(points: TraceroutePoint[], options: TracerouteMapOptions): void;
  revealHop(visibleCount: number): void;
  focusHop(index: number, force?: boolean): void;
  fitToData(): void;
  destroy(): void;
  zoomIn?(): void;
  zoomOut?(): void;
}
