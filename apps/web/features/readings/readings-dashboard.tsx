"use client";

import { useCallback, useState } from "react";
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

  const formattedTime = reading?.createdAt
    ? new Date(reading.createdAt).toLocaleString()
    : "-";

  const lastUpdatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "-";

  const errorMessage = error ? "Unable to reach the backend." : null;

  return (
    <div className="min-h-screen bg-grid">
      <header className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-8">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              ESP32 Lab Excercise 1
            </p>
            <h1 className="font-display text-xl text-slate-950 sm:text-2xl">
              Temperature & Humidity Dashboard
            </h1>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 text-sm text-slate-600 sm:w-auto sm:items-end">
          <span className="w-full rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-center text-xs uppercase tracking-wide sm:min-w-[18rem] sm:w-auto">
            {isLoading ? "Loading sensor data..." : statusMessage}
          </span>
          <span className="text-xs text-slate-500">
            Last updated: {lastUpdatedTime}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-10 sm:pb-20">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                  Live telemetry
                </p>
                <h2 className="font-display text-3xl text-slate-950 sm:text-5xl">
                  Temperature & humidity
                </h2>
                <p className="mt-3 max-w-md text-base text-slate-600">
                  Streaming data from your ESP32 sensor hub. The dashboard polls
                  the backend every 5 seconds to keep the latest readings front
                  and center.
                </p>
              </div>
              <button
                className="w-full rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white sm:w-auto sm:min-w-[7.5rem]"
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
                <p className="mt-4 text-4xl font-semibold text-slate-950 sm:text-5xl">
                  {reading ? reading.temperature.toFixed(1) : "--"}
                  <span className="text-xl text-slate-400 sm:text-2xl">°C</span>
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  Comfortable range: 18°C – 26°C
                </p>
              </div>
              <div className="metric-card">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                  Humidity
                </p>
                <p className="mt-4 text-4xl font-semibold text-slate-950 sm:text-5xl">
                  {reading ? reading.humidity.toFixed(0) : "--"}
                  <span className="text-xl text-slate-400 sm:text-2xl">%</span>
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>Device status</span>
                  <span className="w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
                    {reading?.status ?? "offline"}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>Recorded at</span>
                  <span className="text-right text-slate-800">
                    {formattedTime}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>Backend</span>
                  <span className="break-all text-right text-slate-800 sm:max-w-48">
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-400">Name</span>
                  <span className="text-right text-slate-100">
                    Max Kashela Kabechani
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-400">Student ID</span>
                  <span className="text-right text-slate-100">2022066081</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
