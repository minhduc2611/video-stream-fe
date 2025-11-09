"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Bar,
  BarChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
} from "recharts"

import { apiService, type MetricsInsights } from "@/lib/api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

type ChartEmptyStateProps = {
  message: string
}

const ChartEmptyState = ({ message }: ChartEmptyStateProps) => (
  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
    {message}
  </div>
)

const formatNumber = (value?: number | null, options?: Intl.NumberFormatOptions) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "--"
  }

  return value.toLocaleString(undefined, options)
}

const formatMilliseconds = (value?: number | null, decimals = 0) =>
  formatNumber(value, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })

const formatMillisecondsToSeconds = (value?: number | null, decimals = 1) =>
  formatNumber(
    value != null ? value / 1000 : value,
    {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    },
  )

export default function InsightsPage() {
  const [insights, setInsights] = useState<MetricsInsights | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadInsights = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await apiService.getMetricsInsights()
        if (response.success && response.data) {
          setInsights(response.data)
        } else {
          throw new Error(response.error || "Failed to load metrics insights")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load metrics insights")
        setInsights(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadInsights()
  }, [])

  const stats = useMemo(() => {
    if (!insights) {
      return [
        {
          label: "Avg Processing Duration (s)",
          value: "--",
          helper: "Waiting for benchmark runs",
        },
        {
          label: "API p95 Latency (ms)",
          value: "--",
          helper: "Waiting for latency samples",
        },
        {
          label: "Avg First Frame (ms)",
          value: "--",
          helper: "Waiting for playback telemetry",
        },
        {
          label: "Avg Server Startup (ms)",
          value: "--",
          helper: "Waiting for startup samples",
        },
      ]
    }

    const processingRuns = insights.video_processing.totals.run_count
    const latencySamples = insights.api_latency.totals.sample_count
    const playbackSamples = insights.playback.totals.sample_count
    const startupSamples = insights.server_startup.totals.sample_count

    return [
      {
        label: "Avg Processing Duration (s)",
        value: formatMillisecondsToSeconds(insights.video_processing.totals.avg_total_duration_ms),
        helper: `${formatNumber(processingRuns)} benchmark runs`,
      },
      {
        label: "API p95 Latency (ms)",
        value: formatMilliseconds(insights.api_latency.totals.p95_latency_ms),
        helper: `${formatNumber(latencySamples)} requests`,
      },
      {
        label: "Avg First Frame (ms)",
        value: formatMilliseconds(insights.playback.totals.avg_first_frame_ms),
        helper: `${formatNumber(playbackSamples)} playback sessions`,
      },
      {
        label: "Avg Server Startup (ms)",
        value: formatMilliseconds(insights.server_startup.totals.avg_startup_ms),
        helper: `${formatNumber(startupSamples)} startup samples`,
      },
    ]
  }, [insights])

  const processingTrend = useMemo(() => {
    if (!insights) {
      return []
    }

    return insights.video_processing.recent_runs
      .slice()
      .sort(
        (a, b) =>
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
      )
      .map((run) => ({
        label: new Date(run.started_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        totalDuration: Math.max(run.total_duration_ms, 0) / 1000,
        avgStepDuration:
          run.step_count > 0 ? Math.max(run.total_duration_ms, 0) / run.step_count / 1000 : 0,
      }))
  }, [insights])

  const latencyByRoute = useMemo(() => {
    if (!insights) {
      return []
    }

    return insights.api_latency.by_route.slice(0, 6).map((route) => ({
      route: `${route.method} ${route.route}`,
      avgLatency: route.avg_latency_ms ?? 0,
      p95Latency: route.p95_latency_ms ?? 0,
    }))
  }, [insights])

  const playbackByCountry = useMemo(() => {
    if (!insights) {
      return []
    }

    return insights.playback.by_country.slice(0, 5).map((country) => ({
      country: country.country,
      firstFrame: country.avg_first_frame_ms ?? 0,
      startup: country.avg_total_startup_ms ?? 0,
    }))
  }, [insights])

  const startupMix = useMemo(() => {
    if (!insights) {
      return []
    }

    const cold = insights.server_startup.totals.cold_start_count
    const warm = insights.server_startup.totals.warm_start_count
    const total = cold + warm

    if (total === 0) {
      return []
    }

    const toShare = (count: number) => Math.round((count / total) * 1000) / 10

    return [
      {
        key: "cold",
        label: "Cold Start",
        count: cold,
        share: toShare(cold),
      },
      {
        key: "warm",
        label: "Warm Start",
        count: warm,
        share: toShare(warm),
      },
    ]
  }, [insights])

  const startupColors = {
    cold: "var(--chart-1)",
    warm: "var(--chart-2)",
  } as const

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading insights…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Insights</h1>
          <p className="text-muted-foreground">
            Track processing benchmarks, API performance, playback quality, and runtime health in one view.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="space-y-1 pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl font-semibold">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{stat.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Processing Benchmarks</CardTitle>
              <CardDescription>Aggregate upload and transcoding durations for recent runs.</CardDescription>
            </CardHeader>
            <CardContent>
              {processingTrend.length === 0 ? (
                <ChartEmptyState message="No processing runs recorded yet." />
              ) : (
                <ChartContainer
                  className="h-[320px]"
                  config={{
                    totalDuration: {
                      label: "Total Duration (s)",
                      color: "var(--chart-1)",
                    },
                    avgStepDuration: {
                      label: "Avg Step Duration (s)",
                      color: "var(--chart-2)",
                    },
                  }}
                >
                  <LineChart data={processingTrend}>
                    <CartesianGrid vertical={false} strokeDasharray="4 8" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="totalDuration"
                      stroke="var(--color-totalDuration)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgStepDuration"
                      stroke="var(--color-avgStepDuration)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Latency by Route</CardTitle>
              <CardDescription>Average and p95 response times for the busiest endpoints.</CardDescription>
            </CardHeader>
            <CardContent>
              {latencyByRoute.length === 0 ? (
                <ChartEmptyState message="No API latency samples yet." />
              ) : (
                <ChartContainer
                  className="h-[320px]"
                  config={{
                    p95Latency: {
                      label: "p95 (ms)",
                      color: "var(--chart-1)",
                    },
                    avgLatency: {
                      label: "Average (ms)",
                      color: "var(--chart-2)",
                    },
                  }}
                >
                  <BarChart data={latencyByRoute}>
                    <CartesianGrid vertical={false} strokeDasharray="4 8" />
                    <XAxis
                      dataKey="route"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      height={64}
                      interval={0}
                    />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="p95Latency" fill="var(--color-p95Latency)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="avgLatency" fill="var(--color-avgLatency)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Playback Start Performance</CardTitle>
              <CardDescription>Average first frame and startup times by top viewing regions.</CardDescription>
            </CardHeader>
            <CardContent>
              {playbackByCountry.length === 0 ? (
                <ChartEmptyState message="No playback telemetry captured yet." />
              ) : (
                <ChartContainer
                  className="h-[320px]"
                  config={{
                    firstFrame: {
                      label: "First Frame (ms)",
                      color: "var(--chart-1)",
                    },
                    startup: {
                      label: "Startup (ms)",
                      color: "var(--chart-2)",
                    },
                  }}
                >
                  <AreaChart data={playbackByCountry}>
                    <defs>
                      <linearGradient id="firstFrameGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-firstFrame)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--color-firstFrame)" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="startupGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-startup)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--color-startup)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="4 8" />
                    <XAxis dataKey="country" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="firstFrame"
                      stroke="var(--color-firstFrame)"
                      fill="url(#firstFrameGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="startup"
                      stroke="var(--color-startup)"
                      fill="url(#startupGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Server Startup Mix</CardTitle>
              <CardDescription>Distribution of cold versus warm starts across recorded samples.</CardDescription>
            </CardHeader>
            <CardContent>
              {startupMix.length === 0 ? (
                <ChartEmptyState message="No startup telemetry captured yet." />
              ) : (
                <ChartContainer
                  className="h-[320px]"
                  config={{
                    cold: { label: "Cold Start", color: startupColors.cold },
                    warm: { label: "Warm Start", color: startupColors.warm },
                  }}
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          nameKey="label"
                          formatter={(value, _name, item) => {
                            const payload = item?.payload as (typeof startupMix)[number] | undefined
                            if (!payload) {
                              return value
                            }

                            return (
                              <div className="flex w-full items-center justify-between text-xs">
                                <span>{payload.label}</span>
                                <span className="font-mono font-medium">
                                  {payload.share.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                  % ({payload.count})
                                </span>
                              </div>
                            )
                          }}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent nameKey="key" />} />
                    <Pie
                      data={startupMix}
                      dataKey="count"
                      nameKey="key"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={6}
                      cornerRadius={8}
                    >
                      {startupMix.map((segment) => (
                        <Cell
                          key={segment.key}
                          fill={startupColors[segment.key as keyof typeof startupColors]}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
