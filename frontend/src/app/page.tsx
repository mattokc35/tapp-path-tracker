"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./page.module.css";

type AnalysisResponse = {
  summary: {
    total_rides: number;
    total_spent: number;
    average_fare: number;
    date_range: { start: string; end: string };
  };
  rides_per_month: Array<{ month: string; rides: number }>;
  spend_per_month: Array<{ month: string; spend: number }>;
  rides_by_day_of_week: Array<{ day: string; rides: number }>;
  top_routes: Array<{ origin: string; destination: string; rides: number }>;
  recommendation: {
    overall: {
      best_option: string;
      reasoning: string;
      savings_vs_next_best: number;
      options: Record<string, number>;
    };
    per_month: Array<{
      month: string;
      rides: number;
      best_option: string;
      savings_vs_next_best: number;
      options: Record<string, number>;
    }>;
  };
  detected_columns: Record<string, string>;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  const recommendationRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.recommendation.overall.options).map(([plan, cost]) => ({
      plan,
      cost,
      isBest: plan === data.recommendation.overall.best_option,
    }));
  }, [data]);

  const handleUpload = async () => {
    setError(null);
    setData(null);

    if (!file) {
      setError("Please choose a CSV file first.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail ?? "Upload failed.");
      }

      const payload = (await response.json()) as AnalysisResponse;
      setData(payload);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unexpected upload error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <h1>TAPP PATH Tracker</h1>
      <p>Upload your NJ Transit PATH ride CSV to analyze usage, spend, and best fare plan.</p>

      <section className={styles.uploadCard}>
        <label htmlFor="csv-upload">CSV file</label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button onClick={handleUpload} disabled={loading}>
          {loading ? "Uploading..." : "Upload CSV"}
        </button>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {data ? (
        <>
          <section className={styles.summaryGrid}>
            <div className={styles.card}>
              <h3>Total rides</h3>
              <p>{data.summary.total_rides}</p>
            </div>
            <div className={styles.card}>
              <h3>Total spent</h3>
              <p>${data.summary.total_spent.toFixed(2)}</p>
            </div>
            <div className={styles.card}>
              <h3>Average fare</h3>
              <p>${data.summary.average_fare.toFixed(2)}</p>
            </div>
            <div className={styles.card}>
              <h3>Date range</h3>
              <p>
                {data.summary.date_range.start} to {data.summary.date_range.end}
              </p>
            </div>
          </section>

          <section className={styles.chartGrid}>
            <div className={styles.card}>
              <h3>Rides per month</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.rides_per_month}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rides" name="Rides" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.card}>
              <h3>Spend per month</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.spend_per_month}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="spend" name="Spend ($)" stroke="#16a34a" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.card}>
              <h3>Rides by day of week</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.rides_by_day_of_week}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rides" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.card}>
            <h3>Recommendation</h3>
            <p>
              <strong>Best plan:</strong> {data.recommendation.overall.best_option}
            </p>
            <p>{data.recommendation.overall.reasoning}</p>
            <p>
              Estimated savings vs next best: ${data.recommendation.overall.savings_vs_next_best.toFixed(2)}
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Estimated total cost</th>
                  <th>Best choice</th>
                </tr>
              </thead>
              <tbody>
                {recommendationRows.map((row) => (
                  <tr key={row.plan}>
                    <td>{row.plan}</td>
                    <td>${row.cost.toFixed(2)}</td>
                    <td>{row.isBest ? "Yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {data.top_routes.length > 0 ? (
            <section className={styles.card}>
              <h3>Top routes</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>Rides</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_routes.map((route, idx) => (
                    <tr key={`${route.origin}-${route.destination}-${idx}`}>
                      <td>{route.origin}</td>
                      <td>{route.destination}</td>
                      <td>{route.rides}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
