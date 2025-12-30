"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import "leaflet-ant-path";

type AnimatedRouteProps = {
    positions: [number, number][];
};

export default function AnimatedRoute({ positions }: AnimatedRouteProps) {
    const map = useMap();

    useEffect(() => {
        if (positions.length < 2) return;

        // // ✅ leaflet-ant-path attaches antPath to the Leaflet global
        // // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LAny = (window as any).L;

        if (!LAny?.polyline?.antPath) return;

        const antPolyline = LAny.polyline.antPath(positions, {
            delay: 900, // // lower = faster movement
            dashArray: [10, 20], // // dot-gap pattern
            weight: 4,
            paused: false,
            reverse: false,
            hardwareAccelerated: true,
        });

        antPolyline.addTo(map);

        return () => {
            map.removeLayer(antPolyline);
        };
    }, [map, positions]);

    return null;
}
