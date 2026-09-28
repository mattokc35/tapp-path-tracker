"use client";

import type { ChangeEvent, DragEvent } from "react";
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

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleFileSelect = (selected: File | null) => {
    setError(null);
    setFile(selected);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) handleFileSelect(dropped);
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
      <section className={styles.hero}>
        <span className={styles.heroBadge}>NJ Transit PATH</span>
        <h1>TAPP Path Tracker</h1>
        <p>
          Upload your PATH trip-history CSV to see usage trends, stored-value spend, and the
          fare plan that saves you the most.
        </p>
      </section>

      <section className={styles.uploadCard}>
        <div className={styles.uploadHeader}>
          <h2>Upload trip history</h2>
          <p>Drop your TAPP export below, or browse to select the file.</p>
        </div>

        <label
          htmlFor="csv-upload"
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            id="csv-upload"
            type="file"
            accept=".csv,text/csv"
            className={styles.dropzoneInput}
            onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
          />
          <span className={styles.dropzoneIcon} aria-hidden="true">
            ⬆
          </span>
          <span className={styles.dropzoneText}>
            {isDragging ? "Drop your CSV to upload" : "Drag & drop your CSV here"}
          </span>
          <span className={styles.dropzoneHint}>or click to browse files</span>
        </label>

        {file ? (
          <div className={styles.fileChip}>
            <span className={styles.fileChipIcon} aria-hidden="true">
              📄
            </span>
            <span className={styles.fileChipName}>{file.name}</span>
            <span className={styles.fileChipSize}>{formatFileSize(file.size)}</span>
            <button
              type="button"
              className={styles.fileChipRemove}
              onClick={() => handleFileSelect(null)}
              aria-label="Remove selected file"
            >
              ✕
            </button>
          </div>
        ) : null}

        <p className={styles.uploadHint}>
          Expected headers: Reference, Transit Account #, Trip time, Mode, Location, Product
          Type, Fare Amount ($). Values like <code>=&quot;100060443445&quot;</code> are cleaned
          automatically, and <code>-</code> fares are treated as pass-based rides.
        </p>

        <details className={styles.advanced}>
          <summary className={styles.advancedSummary}>Optional: override pack pricing</summary>
          <div className={styles.priceGrid}>
            <label className={styles.priceField}>
              <span>10-Trip price</span>
              <div className={styles.priceInputWrap}>
                <span className={styles.priceInputPrefix}>$</span>
                <input
                  id="ten-trip-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="31.00"
                  value={packPrices.tenTrip}
                  onChange={handlePackPriceChange("tenTrip")}
                />
              </div>
            </label>
            <label className={styles.priceField}>
              <span>20-Trip price</span>
              <div className={styles.priceInputWrap}>
                <span className={styles.priceInputPrefix}>$</span>
                <input
                  id="twenty-trip-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="62.00"
                  value={packPrices.twentyTrip}
                  onChange={handlePackPriceChange("twentyTrip")}
                />
              </div>
            </label>
            <label className={styles.priceField}>
              <span>40-Trip price</span>
              <div className={styles.priceInputWrap}>
                <span className={styles.priceInputPrefix}>$</span>
                <input
                  id="forty-trip-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="124.00"
                  value={packPrices.fortyTrip}
                  onChange={handlePackPriceChange("fortyTrip")}
                />
              </div>
            </label>
          </div>
        </details>

        <div className={styles.submitRow}>
          <button
            className={styles.submitButton}
            onClick={handleUpload}
            disabled={loading || !file}
          >
            {loading ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Analyzing...
              </>
            ) : (
              "Analyze CSV"
            )}
          </button>
        </div>

        {error ? (
          <div className={styles.alertError} role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}
      </section>

      {data ? (
        <>
          <h2 className={styles.sectionTitle}>Overview</h2>
          <section className={styles.summaryGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total rides</span>
              <span className={styles.statValue}>{data.summary.total_rides}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Stored Value spend</span>
              <span className={styles.statValue}>${data.summary.total_spent.toFixed(2)}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Stored Value avg fare</span>
              <span className={styles.statValue}>
                ${data.summary.average_stored_value_fare.toFixed(2)}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Stored Value rides</span>
              <span className={styles.statValue}>{data.summary.stored_value_ride_count}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Pass-based rides</span>
              <span className={styles.statValue}>{data.summary.pass_ride_count}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Date range</span>
              <span className={styles.statValueSmall}>
                {data.summary.date_range.start} to {data.summary.date_range.end}
              </span>
            </div>
          </section>

          <h2 className={styles.sectionTitle}>Usage trends</h2>
          <section className={styles.chartGrid}>
            <div className={styles.card}>
              <h3>Rides per month</h3>
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
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
            </div>

            <div className={styles.card}>
              <h3>Stored Value spend per month</h3>
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
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
            </div>

            <div className={styles.card}>
              <h3>Rides by day of week</h3>
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
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
            </div>

            <div className={styles.card}>
              <h3>Most-used locations</h3>
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
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
            </div>
          </section>

          <h2 className={styles.sectionTitle}>Product & plan details</h2>
          <section className={styles.card}>
            <h3>Product type breakdown</h3>
            <div className={styles.tableWrap}>
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
            </div>
          </section>

          <section className={styles.recommendationCard}>
            <span className={styles.recommendationBadge}>Best value</span>
            <h3>{formatPlanName(data.recommendation.overall.best_option)}</h3>
            <p>{data.recommendation.overall.reasoning}</p>
            <p className={styles.recommendationSavings}>
              Estimated savings vs next best: $
              {data.recommendation.overall.savings_vs_next_best.toFixed(2)}
            </p>

            <div className={styles.tableWrap}>
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
                    <tr key={row.plan} className={row.isBest ? styles.bestRow : undefined}>
                      <td>{row.planLabel}</td>
                      <td>${row.cost.toFixed(2)}</td>
                      <td>{row.isBest ? <span className={styles.bestBadge}>✓ Best</span> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.card}>
            <h3>Trip history</h3>
            <div className={styles.tableWrap}>
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
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
