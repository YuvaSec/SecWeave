"use client";

type HopTableHop = {
  hop: number;
  ip: string | null;
  host?: string | null;
  rtt: [string, string, string];
  rttMs?: number | null;
};

type HopTableProps = {
  hops: HopTableHop[];
  activeHopIndex: number | null;
  onSelectHop: (index: number) => void;
};

function formatRtt(
  value: string,
  rttMs?: number | null
): { text: string; muted: boolean } {
  if (typeof rttMs === "number" && !Number.isNaN(rttMs)) {
    return { text: `${rttMs.toFixed(3)} ms`, muted: false };
  }
  if (!value || value === "*") return { text: "—", muted: true };
  const m = value.match(/(\d+(\.\d+)?)/);
  if (!m) return { text: "—", muted: true };
  const numeric = Number(m[1]);
  if (Number.isNaN(numeric)) return { text: "—", muted: true };
  return { text: `${numeric.toFixed(3)} ms`, muted: false };
}

export default function HopTable({
  hops,
  activeHopIndex,
  onSelectHop,
}: HopTableProps) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">HOP</th>
            <th className="px-4 py-3 text-left font-semibold">IP ADDRESS / HOST</th>
            <th className="px-4 py-3 text-left font-semibold">RTT</th>
          </tr>
        </thead>
        <tbody>
          {hops.map((hop, index) => {
            const isActive = activeHopIndex === index;
            const host = hop.host?.trim();
            const ip = hop.ip?.trim();
            const primary = host || ip || "—";
            const secondary = host && ip && host !== ip ? ip : null;
            const rtt = formatRtt(hop.rtt[0], hop.rttMs);

            return (
              <tr
                key={`${hop.hop}-${index}`}
                className={`cursor-pointer border-b border-zinc-100 transition ${
                  isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
                onClick={() => onSelectHop(index)}
              >
                <td
                  className={`whitespace-nowrap px-4 py-3 font-medium text-zinc-900 ${
                    isActive ? "border-l-4 border-zinc-900 pl-3" : ""
                  }`}
                >
                  {hop.hop}
                </td>
                <td className="px-4 py-3 text-zinc-900">
                  <div className="font-medium">{primary}</div>
                  {secondary ? (
                    <div className="text-xs text-zinc-500">{secondary}</div>
                  ) : null}
                </td>
                <td className={`whitespace-nowrap px-4 py-3 ${rtt.muted ? "text-zinc-400" : "text-zinc-900"}`}>
                  {rtt.text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
