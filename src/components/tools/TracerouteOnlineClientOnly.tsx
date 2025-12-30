"use client";

import dynamic from "next/dynamic";

// ✅ This runs only in the browser, so Leaflet won't be evaluated on the server.
const TracerouteOnlineClient = dynamic(
    () => import("./TracerouteOnlineClient"),
    {
        ssr: false,
        loading: () => (
            <div className="text-sm text-muted-foreground">Loading traceroute map…</div>
        ),
    }
);

export default function TracerouteOnlineClientOnly() {
    return <TracerouteOnlineClient />;
}
