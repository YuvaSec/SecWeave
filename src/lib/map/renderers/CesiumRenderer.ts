import * as Cesium from "cesium";
import type { MapRenderer, TracerouteMapOptions, TraceroutePoint } from "./MapRenderer";

type SegmentEntity = {
  entity: Cesium.Entity;
  toIndex: number;
};

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;
const MARKER_ICON = "/leaflet/marker-icon.png";
const MARKER_SHADOW = "/leaflet/marker-shadow.png";

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

function colorForRtt(ms: number | null): string {
  if (ms === null) return "#94a3b8";
  if (ms < 30) return "#22c55e";
  if (ms < 80) return "#84cc16";
  if (ms < 150) return "#f59e0b";
  return "#ef4444";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Map Leaflet-style zoom levels to Cesium camera heights for a familiar scale.
function zoomToHeight(zoom: number): number {
  if (zoom <= 2) return 24000000;
  if (zoom === 3) return 20000000;
  if (zoom === 4) return 10000000;
  if (zoom === 5) return 5000000;
  if (zoom === 6) return 2500000;
  return 5000000 / Math.pow(2, zoom - 5);
}

// Rough inverse mapping so we can decide between pan vs fly.
function heightToZoom(height: number): number {
  if (height >= 18000000) return 3;
  if (height >= 9000000) return 4;
  if (height >= 4500000) return 5;
  return 6;
}

export class CesiumRenderer implements MapRenderer {
  private viewer: Cesium.Viewer | null = null;
  private dataSource: Cesium.CustomDataSource | null = null;
  private container: HTMLDivElement | null = null;
  private overlayRoot: HTMLDivElement | null = null;
  private popupEl: HTMLDivElement | null = null;
  private pulseEl: HTMLDivElement | null = null;
  private warningEl: HTMLDivElement | null = null;
  private points: TraceroutePoint[] = [];
  private segments: SegmentEntity[] = [];
  private markerEntities: Cesium.Entity[] = [];
  private shadowEntities: Cesium.Entity[] = [];
  private routeBaseEntity: Cesium.Entity | null = null;
  private routePulseEntity: Cesium.Entity | null = null;
  private currentHopIndex: number | null = null;
  private popupHopIndex: number | null = null;
  private options: TracerouteMapOptions = {
    followZoom: 5,
    flyToHop: true,
    revealDelayMs: 1200,
  };
  private animationTimerId: number | null = null;
  private lastPointsSignature = "";
  private lastFollowZoom: number | null = null;

  init(containerEl: HTMLDivElement) {
    if (typeof window !== "undefined") {
      (window as any).CESIUM_BASE_URL = "/cesium";
    }

    const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
    if (ionToken) {
      // Cesium's default imagery needs an ion token; set it before the viewer boots.
      Cesium.Ion.defaultAccessToken = ionToken;
    }

    this.container = containerEl;
    this.container.innerHTML = "";
    this.container.style.position = "relative";

    const osmProvider = new Cesium.OpenStreetMapImageryProvider({
      url: "https://a.tile.openstreetmap.org/",
    });

    const viewer = new Cesium.Viewer(containerEl, {
      animation: false,
      timeline: false,
      geocoder: false,
      baseLayerPicker: false,
      homeButton: false,
      fullscreenButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      vrButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      imageryProvider: osmProvider,
      sceneMode: Cesium.SceneMode.SCENE3D,
    });

    viewer.scene.fog.enabled = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    viewer.scene.sun.show = false;
    viewer.scene.moon.show = false;
    viewer.scene.shadowMap.enabled = false;
    if (viewer.scene.postProcessStages?.fxaa) {
      viewer.scene.postProcessStages.fxaa.enabled = false;
    }
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true;

    this.viewer = viewer;
    this.dataSource = new Cesium.CustomDataSource("traceroute");
    viewer.dataSources.add(this.dataSource);

    this.overlayRoot = document.createElement("div");
    this.overlayRoot.style.position = "absolute";
    this.overlayRoot.style.inset = "0";
    this.overlayRoot.style.pointerEvents = "none";
    this.overlayRoot.style.zIndex = "2";
    this.container.appendChild(this.overlayRoot);

    this.pulseEl = document.createElement("div");
    this.pulseEl.className = "leaflet-pulse-icon";
    this.pulseEl.innerHTML =
      '<div class="pulse-wrap"><div class="pulse-ring"></div><div class="pulse-dot"></div></div>';
    this.pulseEl.style.position = "absolute";
    this.pulseEl.style.transform = "translate(-50%, -50%)";
    this.pulseEl.style.pointerEvents = "none";
    this.pulseEl.style.display = "none";
    this.overlayRoot.appendChild(this.pulseEl);

    this.warningEl = document.createElement("div");
    this.warningEl.className =
      "pointer-events-auto absolute left-3 right-3 top-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm";
    this.warningEl.style.display = "none";
    this.overlayRoot.appendChild(this.warningEl);

    this.popupEl = document.createElement("div");
    this.popupEl.style.position = "absolute";
    this.popupEl.style.transform = "translate(-50%, -100%)";
    this.popupEl.style.pointerEvents = "auto";
    this.popupEl.style.display = "none";
    this.popupEl.className =
      "rounded-lg border bg-white p-3 text-sm shadow-md text-zinc-900";
    this.overlayRoot.appendChild(this.popupEl);

    this.popupEl.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.dataset?.action === "close-popup") {
        this.hidePopup();
      }
    });

    viewer.screenSpaceEventHandler.setInputAction(
      (movement) => {
        if (!this.viewer) return;
        const picked = this.viewer.scene.pick(movement.position);
        const pickedEntity = Cesium.defined(picked) ? (picked as any).id : null;
        const indexProp = pickedEntity?.properties?.tracerouteIndex;
        const index = indexProp ? indexProp.getValue() : null;
        if (typeof index === "number") {
          this.showPopup(index);
        } else {
          this.hidePopup();
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    viewer.scene.postRender.addEventListener(() => {
      this.updatePulsePosition();
      this.updatePopupPosition();
    });

    const baseLayer = viewer.imageryLayers.get(0);
    if (baseLayer) {
      this.attachImageryErrorHandler(baseLayer, "OpenStreetMap");
    }

    if (!ionToken) {
      // Missing ion token is the most common cause of blue basemaps in Cesium.
      this.showWarning(
        "Cesium ion token missing; using OpenStreetMap tiles. Set NEXT_PUBLIC_CESIUM_ION_TOKEN to enable ion imagery."
      );
    } else {
      Cesium.createWorldImageryAsync()
        .then((provider) => {
          if (!this.viewer) return;
          this.viewer.imageryLayers.removeAll();
          const layer = this.viewer.imageryLayers.addImageryProvider(provider);
          this.attachImageryErrorHandler(layer, "Cesium ion");
          this.requestRender();
        })
        .catch(() => {
          // Fall back to OSM if ion imagery fails (token invalid/CSP/adblock).
          this.showWarning(
            "Cesium ion imagery failed to load; falling back to OpenStreetMap tiles."
          );
        });
    }

    this.setInitialView(DEFAULT_CENTER[0], DEFAULT_CENTER[1], DEFAULT_ZOOM);
  }

  setData(points: TraceroutePoint[], options: TracerouteMapOptions) {
    const followZoomChanged = this.lastFollowZoom !== options.followZoom;
    this.lastFollowZoom = options.followZoom;
    this.options = options;
    if (!this.viewer || !this.dataSource) return;

    const signature = points
      .map((p) => `${p.hop}:${p.lat.toFixed(4)},${p.lon.toFixed(4)}`)
      .join("|");
    const pointsChanged = signature !== this.lastPointsSignature;
    this.lastPointsSignature = signature;
    this.points = points;

    if (pointsChanged) {
      this.dataSource.entities.removeAll();
      this.markerEntities = [];
      this.shadowEntities = [];
      this.segments = [];
      this.routeBaseEntity = null;
      this.routePulseEntity = null;
      this.popupHopIndex = null;
      this.currentHopIndex = null;

      points.forEach((point, index) => {
        const position = Cesium.Cartesian3.fromDegrees(point.lon, point.lat);

        const shadowEntity = this.dataSource!.entities.add({
          position,
          show: false,
          billboard: {
            image: MARKER_SHADOW,
            width: 41,
            height: 41,
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(-12, 0),
          },
        });

        const markerEntity = this.dataSource!.entities.add({
          position,
          show: false,
          billboard: {
            image: MARKER_ICON,
            width: 25,
            height: 41,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          },
          properties: new Cesium.PropertyBag({
            tracerouteIndex: index,
          }),
        });

        this.shadowEntities.push(shadowEntity);
        this.markerEntities.push(markerEntity);
      });

      for (let i = 1; i < points.length; i++) {
        const from = points[i - 1];
        const to = points[i];
        const ms = hopRttMs(to.rtt);
        const color = colorForRtt(ms);

        const entity = this.dataSource.entities.add({
          show: false,
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(from.lon, from.lat),
              Cesium.Cartesian3.fromDegrees(to.lon, to.lat),
            ],
            width: 4,
            material: Cesium.Color.fromCssColorString(color).withAlpha(0.85),
            clampToGround: true,
          },
        });

        this.segments.push({ entity, toIndex: i });
      }

      if (points.length >= 2) {
        const routePositions = points.map((p) =>
          Cesium.Cartesian3.fromDegrees(p.lon, p.lat)
        );

        this.routeBaseEntity = this.dataSource.entities.add({
          show: false,
          polyline: {
            positions: routePositions,
            width: 4,
            material: Cesium.Color.fromCssColorString("#3388ff").withAlpha(0.25),
            clampToGround: true,
          },
        });

        // Approximate Leaflet's ant-path with a pulsing dashed overlay.
        const pulseColor = new Cesium.CallbackProperty(() => {
          const now = Date.now();
          const t = (now % 1100) / 1100;
          const alpha = 0.3 + 0.45 * Math.sin(t * Math.PI * 2);
          return Cesium.Color.fromCssColorString("#3388ff").withAlpha(alpha);
        }, false);

        this.routePulseEntity = this.dataSource.entities.add({
          show: false,
          polyline: {
            positions: routePositions,
            width: 4,
            material: new Cesium.PolylineDashMaterialProperty({
              color: pulseColor,
              gapColor: Cesium.Color.TRANSPARENT,
              dashLength: 14,
            }),
            clampToGround: true,
          },
        });
      }
    }

    if (points.length && (pointsChanged || followZoomChanged)) {
      this.setInitialView(points[0].lat, points[0].lon, options.followZoom);
    }

    this.requestRender();
  }

  revealHop(visibleCount: number) {
    if (!this.viewer) return;

    this.markerEntities.forEach((entity, index) => {
      entity.show = index < visibleCount;
    });
    this.shadowEntities.forEach((entity, index) => {
      entity.show = index < visibleCount;
    });
    this.segments.forEach((segment) => {
      segment.entity.show = segment.toIndex < visibleCount;
    });

    const completed =
      this.points.length >= 2 && visibleCount >= this.points.length;
    if (this.routeBaseEntity) this.routeBaseEntity.show = completed;
    if (this.routePulseEntity) this.routePulseEntity.show = completed;

    if (completed) {
      this.startRoutePulse();
    } else {
      this.stopRoutePulse();
    }

    this.currentHopIndex = visibleCount ? visibleCount - 1 : null;
    if (this.popupHopIndex !== null && this.popupHopIndex >= visibleCount) {
      this.hidePopup();
    }

    this.requestRender();
  }

  focusHop(index: number, force = false) {
    if (!this.viewer) return;
    if (!this.points[index]) return;
    if (!this.options.flyToHop && !force) return;

    const point = this.points[index];
    const destinationHeight = zoomToHeight(this.options.followZoom);
    const destination = Cesium.Cartesian3.fromDegrees(
      point.lon,
      point.lat,
      destinationHeight
    );
    const currentHeight = this.viewer.camera.positionCartographic.height;
    const currentZoom = heightToZoom(currentHeight);
    const duration = Math.min(
      1.4,
      Math.max(0.6, this.options.revealDelayMs / 1000)
    );

    // Match Leaflet: pan when already zoomed in, fly when zooming closer.
    if (currentZoom >= this.options.followZoom) {
      const panDestination = Cesium.Cartesian3.fromDegrees(
        point.lon,
        point.lat,
        currentHeight
      );
      this.viewer.camera.flyTo({
        destination: panDestination,
        duration,
      });
    } else {
      this.viewer.camera.flyTo({
        destination,
        duration,
      });
    }
  }

  fitToData() {
    if (!this.viewer || this.points.length < 2) return;
    const latitudes = this.points.map((p) => p.lat);
    const longitudes = this.points.map((p) => p.lon);
    const rectangle = Cesium.Rectangle.fromDegrees(
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes)
    );
    this.viewer.camera.flyTo({
      destination: rectangle,
      duration: 0.9,
    });
  }

  zoomIn() {
    if (!this.viewer) return;
    this.viewer.camera.zoomIn(800000);
  }

  zoomOut() {
    if (!this.viewer) return;
    this.viewer.camera.zoomOut(800000);
  }

  destroy() {
    this.stopRoutePulse();
    if (this.viewer) {
      this.viewer.destroy();
    }
    this.viewer = null;
    this.dataSource = null;
    this.container = null;
    this.overlayRoot = null;
    this.popupEl = null;
    this.pulseEl = null;
    this.warningEl = null;
    this.points = [];
    this.segments = [];
    this.markerEntities = [];
    this.shadowEntities = [];
  }

  private requestRender() {
    if (!this.viewer) return;
    this.viewer.scene.requestRender();
  }

  private setInitialView(lat: number, lon: number, zoom: number) {
    if (!this.viewer) return;
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, zoomToHeight(zoom)),
    });
  }

  private updatePulsePosition() {
    if (!this.viewer || !this.pulseEl) return;
    if (this.currentHopIndex === null || !this.points[this.currentHopIndex]) {
      this.pulseEl.style.display = "none";
      return;
    }

    const point = this.points[this.currentHopIndex];
    const position = Cesium.Cartesian3.fromDegrees(point.lon, point.lat);
    const canvasPosition =
      this.viewer.scene.cartesianToCanvasCoordinates(position);
    if (!canvasPosition) {
      this.pulseEl.style.display = "none";
      return;
    }

    this.pulseEl.style.display = "block";
    this.pulseEl.style.left = `${canvasPosition.x}px`;
    this.pulseEl.style.top = `${canvasPosition.y}px`;
  }

  private showPopup(index: number) {
    if (!this.popupEl || !this.points[index]) return;
    const point = this.points[index];
    this.popupHopIndex = index;

    const lines: string[] = [];
    lines.push(`<div class="font-semibold">Hop ${point.hop}</div>`);
    lines.push(`<div class="text-zinc-700">${escapeHtml(point.ip)}</div>`);
    if (point.label) {
      lines.push(`<div class="text-zinc-600">${escapeHtml(point.label)}</div>`);
    }
    if (point.asn) {
      lines.push(`<div class="text-zinc-600">${escapeHtml(point.asn)}</div>`);
    }
    if (point.isp) {
      lines.push(`<div class="text-zinc-600">${escapeHtml(point.isp)}</div>`);
    }

    const ms = hopRttMs(point.rtt);
    const rttLabel = ms === null ? "N/A" : `${ms.toFixed(1)} ms`;
    lines.push(
      `<div class="mt-2 text-zinc-600">RTT best: <span class="font-medium text-zinc-900">${rttLabel}</span></div>`
    );

    lines.push(
      '<button data-action="close-popup" class="mt-2 text-xs text-zinc-500 hover:text-zinc-800">Close</button>'
    );

    this.popupEl.innerHTML = `<div class="text-sm">${lines.join("")}</div>`;
    this.popupEl.style.display = "block";
    this.updatePopupPosition();
  }

  private hidePopup() {
    if (!this.popupEl) return;
    this.popupHopIndex = null;
    this.popupEl.style.display = "none";
  }

  private updatePopupPosition() {
    if (!this.viewer || !this.popupEl) return;
    if (this.popupHopIndex === null) return;
    const point = this.points[this.popupHopIndex];
    if (!point) return;

    const position = Cesium.Cartesian3.fromDegrees(point.lon, point.lat);
    const canvasPosition =
      this.viewer.scene.cartesianToCanvasCoordinates(position);
    if (!canvasPosition) return;

    this.popupEl.style.left = `${canvasPosition.x}px`;
    this.popupEl.style.top = `${canvasPosition.y - 8}px`;
  }

  private attachImageryErrorHandler(
    layer: Cesium.ImageryLayer,
    label: string
  ) {
    layer.errorEvent.addEventListener((error) => {
      // Network/CSP/adblock failures show here; keep a visible hint for users.
      this.showWarning(
        `${label} tiles failed to load. Check CSP/adblock/network settings.`
      );
      console.warn(`${label} imagery error`, error);
    });
  }

  private showWarning(message: string) {
    if (!this.warningEl) return;
    this.warningEl.textContent = message;
    this.warningEl.style.display = "block";
  }

  private startRoutePulse() {
    if (this.animationTimerId !== null) return;
    this.animationTimerId = window.setInterval(() => {
      this.requestRender();
    }, 90);
  }

  private stopRoutePulse() {
    if (this.animationTimerId === null) return;
    window.clearInterval(this.animationTimerId);
    this.animationTimerId = null;
  }
}
