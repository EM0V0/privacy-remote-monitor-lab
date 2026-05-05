"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonitoringChartRow } from "@/lib/monitoring-insights";

export function DashboardChart({
  data,
  noisyMean,
}: {
  data: MonitoringChartRow[];
  /** DP released mean — clinician horizontal guide from ledger-backed audit. */
  noisyMean?: { value: number; epsilon: number } | null;
}) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.t).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <div className="h-[400px] w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">
        Tremor score trend — raw + EWMA + shift alarms
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Red dots mark CUSUM threshold crossings (research indicator, not a diagnostic alarm).
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#64748b" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" />
          <Tooltip
            contentStyle={{ borderRadius: "8px", borderColor: "#e2e8f0" }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {noisyMean ? (
            <ReferenceLine
              y={noisyMean.value}
              stroke="#7c3aed"
              strokeDasharray="5 5"
              label={{
                value: `DP mean ε=${noisyMean.epsilon.toFixed(2)}`,
                position: "insideTopRight",
                fill: "#5b21b6",
                fontSize: 11,
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="score"
            stroke="#0f766e"
            strokeWidth={2}
            dot={(props) => {
              const payload = props.payload as MonitoringChartRow & { label: string };
              if (!payload?.alarm) return false;
              const { cx, cy } = props;
              if (cx == null || cy == null) return false;
              return <circle cx={cx} cy={cy} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1} />;
            }}
            name="Score"
          />
          <Line
            type="monotone"
            dataKey="ewma"
            stroke="#d97706"
            strokeWidth={2}
            dot={false}
            name="EWMA"
            strokeDasharray="4 4"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
