"use client";

import { ChangeEvent, useMemo, useState } from "react";
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

type TripRecord = {
  reference: string;
  transitAccountNumber: string;
  tripTime: string;
  mode: string;
  location: string;
  productType: string;
  fareAmount: number | null;
};

type BackendTripRecord = {
  reference: string;
  transit_account_number: string;
  trip_time: string;
  mode: string;
  location: string;
  product_type: string;
  fare_amount: number | null;
};

type AnalysisResponse = {
  summary: {
    total_rides: number;
    total_spent: number;
    average_stored_value_fare: number;
    stored_value_ride_count: number;
    pass_ride_count: number;
    date_range: { start: string; end: string };
  };
  rides_per_month: Array<{ month: string; rides: number }>;
  spend_per_month: Array<{ month: string; spend: number }>;
  rides_by_day_of_week: Array<{ day: string; rides: number }>;
  rides_by_location: Array<{ location: string; rides: number }>;
  product_type_breakdown: Array<{
    product_type: string;
    rides: number;
    total_spend: number;
    effective_cost_per_ride: number | null;
  }>;
  trip_history: TripRecord[];
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

type BackendAnalysisResponse = Omit<AnalysisResponse, "trip_history"> & {
  trip_history: BackendTripRecord[];
};

type PackPriceInputs = {
  tenTrip: string;
  twentyTrip: string;
  fortyTrip: string;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const PLAN_LABELS: Record<string, string> = {
  pay_per_ride: "Single Ride ($3.25)",
  "10-trip": "10-Trip",
  "20-trip": "20-Trip",
  "40-trip": "40-Trip",
  unlimited_1_day_pass_all_active_days: "Unlimited 1-Day Pass ($12.50/day used)",
  unlimited_7_day_pass_all_active_weeks: "Unlimited 7-Day Pass ($42.75/week used)",
  unlimited_30_day_pass: "Unlimited 30-Day Pass ($131.50)",
  unlimited_30_day_pass_all_active_months: "Unlimited 30-Day Pass (all active months)",
  unlimited_30_day_pass_or_best_monthly_alternative:
    "Unlimited 30-Day Pass or best monthly alternative",
};

const formatPlanName = (planKey: string) =>
  PLAN_LABELS[planKey] ?? planKey.replaceAll("_", " ");

const formatCurrency = (value: number | null) => (value == null ? "—" : `$${value.toFixed(2)}`);

const formatTripTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const transformTripRecord = (trip: BackendTripRecord): TripRecord => ({
  reference: trip.reference,
  transitAccountNumber: trip.transit_account_number,
  tripTime: trip.trip_time,
  mode: trip.mode,
  location: trip.location,
  productType: trip.product_type,
  fareAmount: trip.fare_amount,
});

const transformResponse = (payload: BackendAnalysisResponse): AnalysisResponse => ({
  ...payload,
  trip_history: payload.trip_history.map(transformTripRecord),
});

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [packPrices, setPackPrices] = useState<PackPriceInputs>({
    tenTrip: "",
    twentyTrip: "",
    fortyTrip: "",
  });

  const recommendationRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.recommendation.overall.options).map(([plan, cost]) => ({
      plan,
      planLabel: formatPlanName(plan),
      cost,
      isBest: plan === data.recommendation.overall.best_option,
    }));
  }, [data]);

  const handlePackPriceChange =
    (field: keyof PackPriceInputs) => (event: ChangeEvent<HTMLInputElement>) => {
      setPackPrices((current) => ({ ...current, [field]: event.target.value }));
    };

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
      if (packPrices.tenTrip) formData.append("ten_trip_price", packPrices.tenTrip);
      if (packPrices.twentyTrip) formData.append("twenty_trip_price", packPrices.twentyTrip);
      if (packPrices.fortyTrip) formData.append("forty_trip_price", packPrices.fortyTrip);

      const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail ?? "Upload failed.");
      }

      const payload = (await response.json()) as BackendAnalysisResponse;
      setData(transformResponse(payload));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unexpected upload error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <h1>TAPP PATH Tracker</h1>
      <p>Upload your NJ Transit PATH trip-history CSV to analyze usage, stored-value spend, and fare options.</p>

      <section className={styles.uploadCard}>
        <label htmlFor="csv-upload">CSV file</label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p>
          Expected headers: Reference, Transit Account #, Trip time, Mode, Location, Product Type,
          Fare Amount ($).
        </p>
        <p>
          Transit account values like <code>=&quot;100060443445&quot;</code> are cleaned
          automatically, and <code>-</code> fares are treated as pass-based rides.
        </p>
        <label htmlFor="ten-trip-price">Optional 10-Trip price override</label>
        <input
          id="ten-trip-price"
          type="number"
          min="0"
          step="0.01"
          value={packPrices.tenTrip}
          onChange={handlePackPriceChange("tenTrip")}
        />
        <label htmlFor="twenty-trip-price">Optional 20-Trip price override</label>
        <input
          id="twenty-trip-price"
          type="number"
          min="0"
          step="0.01"
          value={packPrices.twentyTrip}
          onChange={handlePackPriceChange("twentyTrip")}
        />
        <label htmlFor="forty-trip-price">Optional 40-Trip price override</label>
        <input
          id="forty-trip-price"
          type="number"
          min="0"
          step="0.01"
          value={packPrices.fortyTrip}
          onChange={handlePackPriceChange("fortyTrip")}
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
              <h3>Stored Value spend</h3>
              <p>${data.summary.total_spent.toFixed(2)}</p>
            </div>
            <div className={styles.card}>
              <h3>Stored Value avg fare</h3>
              <p>${data.summary.average_stored_value_fare.toFixed(2)}</p>
            </div>
            <div className={styles.card}>
              <h3>Stored Value rides</h3>
              <p>{data.summary.stored_value_ride_count}</p>
            </div>
            <div className={styles.card}>
              <h3>Pass-based rides</h3>
              <p>{data.summary.pass_ride_count}</p>
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
              <h3>Stored Value spend per month</h3>
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

            <div className={styles.card}>
              <h3>Most-used locations</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.rides_by_location}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="location" interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rides" fill="#ea580c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.card}>
            <h3>Product type breakdown</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product Type</th>
                  <th>Rides</th>
                  <th>Stored Value Spend</th>
                  <th>Effective Cost / Ride</th>
                </tr>
              </thead>
              <tbody>
                {data.product_type_breakdown.map((product) => (
                  <tr key={product.product_type}>
                    <td>{product.product_type}</td>
                    <td>{product.rides}</td>
                    <td>${product.total_spend.toFixed(2)}</td>
                    <td>{formatCurrency(product.effective_cost_per_ride)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.card}>
            <h3>Recommendation</h3>
            <p>
              <strong>Best plan:</strong> {formatPlanName(data.recommendation.overall.best_option)}
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
                    <td>{row.planLabel}</td>
                    <td>${row.cost.toFixed(2)}</td>
                    <td>{row.isBest ? "Yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.card}>
            <h3>Trip history</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Transit Account #</th>
                  <th>Trip Time</th>
                  <th>Mode</th>
                  <th>Location</th>
                  <th>Product Type</th>
                  <th>Fare Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.trip_history.map((trip, index) => (
                  <tr key={`${trip.reference}-${trip.tripTime}-${index}`}>
                    <td>{trip.reference}</td>
                    <td>{trip.transitAccountNumber}</td>
                    <td>{formatTripTime(trip.tripTime)}</td>
                    <td>{trip.mode}</td>
                    <td>{trip.location}</td>
                    <td>{trip.productType}</td>
                    <td>{formatCurrency(trip.fareAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}
