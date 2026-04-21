"use client";

import { cn } from "@auction/ui";
import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type LineSeriesPoint = { x: string; y: number };

export type BarSeriesPoint = { label: string; value: number };

export type DonutSlice = { label: string; value: number };

type LineProps = {
  kind: "line";
  data: readonly LineSeriesPoint[];
  className?: string;
  height?: number;
};

type BarProps = {
  kind: "bar";
  data: readonly BarSeriesPoint[];
  className?: string;
  height?: number;
};

type DonutProps = {
  kind: "donut";
  data: readonly DonutSlice[];
  className?: string;
  size?: number;
};

export type ChartRendererProps = LineProps | BarProps | DonutProps;

const PRIMARY = "#775a19";
const PRIMARY_CONTAINER = "#c5a059";
const SECONDARY = "#5f5e5e";
const ERROR = "#ba1a1a";

const tooltipStyles = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid rgba(127, 118, 103, 0.25)",
    fontSize: 12,
  },
};

function RechartsLine({ data, className, height = 180 }: LineProps) {
  const gid = useId().replace(/:/g, "");
  const gradientId = `areaGrad-${gid}`;
  const chartData = useMemo(() => data.map((d) => ({ name: d.x, value: d.y })), [data]);

  if (chartData.length === 0) {
    return <p className="text-sm text-on-surface-variant">No data</p>;
  }

  return (
    <figure
      className={cn("m-0 w-full text-primary", className)}
      style={{ height }}
      aria-label="Revenue trend chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.35} />
              <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-outline-variant/25"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: "currentColor" }}
            className="text-on-surface-variant"
            interval="preserveStartEnd"
            tickMargin={6}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "currentColor" }}
            className="text-on-surface-variant"
            width={36}
          />
          <Tooltip {...tooltipStyles} formatter={(v: number) => [v.toLocaleString(), "Value"]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={PRIMARY}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}

function RechartsBar({ data, className, height = 180 }: BarProps) {
  const chartData = useMemo(() => data.map((d) => ({ name: d.label, value: d.value })), [data]);

  if (chartData.length === 0) {
    return <p className="text-sm text-on-surface-variant">No data</p>;
  }

  return (
    <figure
      className={cn("m-0 w-full text-primary", className)}
      style={{ height }}
      aria-label="Daily bar chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-outline-variant/25"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: "currentColor" }}
            className="text-on-surface-variant"
            interval="preserveStartEnd"
            tickMargin={6}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "currentColor" }}
            className="text-on-surface-variant"
            width={36}
          />
          <Tooltip {...tooltipStyles} formatter={(v: number) => [v.toLocaleString(), "Count"]} />
          <Bar dataKey="value" fill={PRIMARY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

function RechartsDonut({ data, className, size = 200 }: DonutProps) {
  const chartData = useMemo(() => data.map((d) => ({ name: d.label, value: d.value })), [data]);
  const colors = [PRIMARY, PRIMARY_CONTAINER, SECONDARY, ERROR];

  if (chartData.length === 0 || chartData.every((d) => d.value === 0)) {
    return <p className="text-sm text-on-surface-variant">No data</p>;
  }

  return (
    <figure
      className={cn("m-0 flex flex-col items-center gap-3", className)}
      aria-label="Conversion breakdown"
    >
      <div style={{ width: "100%", maxWidth: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {chartData.map((entry, i) => (
                <Cell key={entry.name} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyles} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ChartRenderer(props: ChartRendererProps) {
  if (props.kind === "line") return <RechartsLine {...props} />;
  if (props.kind === "bar") return <RechartsBar {...props} />;
  return <RechartsDonut {...props} />;
}
