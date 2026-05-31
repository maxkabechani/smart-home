"use client";

import { useCallback, useMemo, useState } from "react";
import { useLatestReadingQuery } from "./queries";

export default function ReadingsDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data, error, isLoading, dataUpdatedAt, refetch } =
    useLatestReadingQuery();

  const reading = data?.success ? data.data : null;
  const statusMessage = data?.success
    ? data.data.status === "online"
      ? "Sensor online"
      : "Sensor offline (stale)"
    : (data?.message ?? "Awaiting sensor data.");

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const formattedTime = useMemo(() => {
    if (!reading?.createdAt) {
      return "-";
    }

    return new Date(reading.createdAt).toLocaleString();
  }, [reading?.createdAt]);

  const lastUpdatedTime = useMemo(() => {
    if (!dataUpdatedAt) {
      return "-";
    }

    return new Date(dataUpdatedAt).toLocaleTimeString();
  }, [dataUpdatedAt]);

  const errorMessage = error ? "Unable to reach the backend." : null;

  return (
    <div className="min-h-screen bg-grid">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8 sm:px-10">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              ESP32 Lab Excercise 1
            </p>
            <h1 className="font-display text-2xl text-slate-950">
              Temperature & Humidity Dashboard
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="min-w-[190px] rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-center text-xs uppercase tracking-wide">
            {isLoading ? "Loading sensor data..." : statusMessage}
          </span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            Last updated: {lastUpdatedTime}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20 sm:px-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel">
            <div className="flex items-start justify-between gap-8">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                  Live telemetry
                </p>
                <h2 className="font-display text-4xl text-slate-950 sm:text-5xl">
                  Temperature & humidity
                </h2>
                <p className="mt-4 max-w-md text-base text-slate-600">
                  Streaming data from your ESP32 sensor hub. The dashboard polls
                  the backend every 5 seconds to keep the latest readings front
                  and center.
                </p>
              </div>
              <button
                className="min-w-[120px] rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                onClick={handleRefresh}
                type="button"
                aria-busy={isRefreshing || isLoading}
                disabled={isRefreshing || isLoading}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <div className="metric-card">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                  Temperature
                </p>
                <p className="mt-4 text-5xl font-semibold text-slate-950">
                  {reading ? reading.temperature.toFixed(1) : "--"}
                  <span className="text-2xl text-slate-400">°C</span>
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  Comfortable range: 18°C – 26°C
                </p>
              </div>
              <div className="metric-card">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                  Humidity
                </p>
                <p className="mt-4 text-5xl font-semibold text-slate-950">
                  {reading ? reading.humidity.toFixed(0) : "--"}
                  <span className="text-2xl text-slate-400">%</span>
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  Target range: 40% – 60%
                </p>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <aside className="stack-panel">
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-soft">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Latest packet
              </p>
              <div className="mt-6 space-y-4 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Device status</span>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
                    {reading?.status ?? "offline"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Recorded at</span>
                  <span className="text-right text-slate-800">
                    {formattedTime}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Backend</span>
                  <span className="text-right text-slate-800">
                    {buildBackendLabel()}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-900 px-6 py-6 text-slate-100 shadow-soft">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                Student details
              </p>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Name</span>
                  <span className="text-right text-slate-100">
                    Max Kashela Kabechani
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Student ID</span>
                  <span className="text-right text-slate-100">2022066081</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Course</span>
                  <span className="text-right text-slate-100">CSC4130</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function buildBackendLabel() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "same-origin proxy";
}
