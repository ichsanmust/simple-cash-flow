import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Calendar,
  FileText,
  FolderOpen,
  PieChart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import SummaryCard from "../components/SummaryCard";
import { categoriesApi, formatRupiah, reportsApi, transactionsApi } from "../api/client";

const CATEGORY_STYLES = [
  { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
  { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  { bar: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200" },
  { bar: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
  { bar: "bg-violet-500", text: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  { bar: "bg-teal-500", text: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200" },
];

export default function Dashboard() {
  const [period, setPeriod] = useState("this_month");
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Helper rentang tanggal
  const getDateRange = (p) => {
    const now = new Date();
    if (p === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      return { date_from: start, date_to: end };
    }
    if (p === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
      return { date_from: start, date_to: end };
    }
    if (p === "this_year") {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0];
      return { date_from: start, date_to: end };
    }
    return {}; // Semua waktu
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Cek apakah user sudah memiliki kategori
      try {
        const catCheck = await categoriesApi.check();
        if (!catCheck.has_categories) {
          navigate("/categories?first_time=true");
          return;
        }
      } catch (catErr) {
        console.error("Gagal memeriksa kategori user:", catErr);
      }

      const range = getDateRange(period);
      const [sumData, trxData] = await Promise.all([
        reportsApi.getSummary(range),
        transactionsApi.list({ ...range, status: "confirmed" }),
      ]);
      setSummary(sumData);
      setRecentTransactions(trxData.slice(0, 5));
    } catch (err) {
      console.error("Gagal memuat dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header & Filter Periode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Cashflow
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ringkasan Kas</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola aliran pendapatan, pengeluaran & saldo keuangan</p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-xs">
          {[
            { id: "this_month", label: "Bulan Ini" },
            { id: "last_month", label: "Bulan Lalu" },
            { id: "this_year", label: "Tahun Ini" },
            { id: "all", label: "Semua" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                period === item.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Banner Pending Drafts */}
      {summary?.pending_drafts_count > 0 && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                Terdapat {summary.pending_drafts_count} struk menunggu konfirmasi
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Struk telah diekstrak oleh AI namun belum masuk ke saldo kas resmi.
              </p>
            </div>
          </div>
          <Link
            to="/drafts"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0 text-center"
          >
            Review & Konfirmasi &rarr;
          </Link>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="Total Pemasukan"
          amount={summary?.total_income || 0}
          icon={TrendingUp}
          color="emerald"
          subtitle="Arus masuk kas"
          badge="Masuk"
        />
        <SummaryCard
          title="Total Pengeluaran"
          amount={summary?.total_expense || 0}
          icon={TrendingDown}
          color="rose"
          subtitle="Biaya operasional & belanja"
          badge="Keluar"
        />
        <SummaryCard
          title="Saldo Bersih"
          amount={summary?.balance || 0}
          icon={Wallet}
          color="indigo"
          subtitle="Arus kas bersih periode ini"
        />
      </div>

      {/* Rasio & Distribusi Cash Flow */}
      {summary && (summary.total_income > 0 || summary.total_expense > 0) && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Rasio & Distribusi Arus Kas</h3>
                <p className="text-xs text-slate-400">Komparasi pengeluaran terhadap total pemasukan periode ini</p>
              </div>
            </div>

            {summary.total_income > 0 && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto ${
                  summary.balance >= 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                    : "bg-rose-50 text-rose-700 border border-rose-200/80"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${summary.balance >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                {summary.balance >= 0
                  ? `${Math.round(((summary.total_income - summary.total_expense) / summary.total_income) * 100)}% Kas Tersimpan (Surplus)`
                  : "Defisit: Pengeluaran Melampaui Pemasukan"}
              </span>
            )}
          </div>

          {/* Segmented Dual Bar */}
          <div className="space-y-2 pt-1">
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 gap-1">
              {summary.total_income > 0 ? (
                <>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((summary.total_expense / summary.total_income) * 100))}%`,
                    }}
                    className="h-full bg-rose-500 rounded-full transition-all duration-700"
                    title={`Pengeluaran: ${formatRupiah(summary.total_expense)}`}
                  />
                  <div
                    style={{
                      width: `${Math.max(0, 100 - Math.round((summary.total_expense / summary.total_income) * 100))}%`,
                    }}
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    title={`Surplus Kas: ${formatRupiah(Math.max(0, summary.balance))}`}
                  />
                </>
              ) : (
                <div className="h-full w-full bg-rose-500 rounded-full" />
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-1.5 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-md bg-rose-500 shrink-0" />
                <span>
                  Pengeluaran: <strong className="text-slate-800">{formatRupiah(summary.total_expense)}</strong> (
                  {summary.total_income > 0
                    ? Math.round((summary.total_expense / summary.total_income) * 100)
                    : 100}
                  %)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-md bg-emerald-500 shrink-0" />
                <span>
                  Sisa Kas / Tabungan: <strong className="text-slate-800">{formatRupiah(Math.max(0, summary.balance))}</strong> (
                  {summary.total_income > 0
                    ? Math.max(0, 100 - Math.round((summary.total_expense / summary.total_income) * 100))
                    : 0}
                  %)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rincian Kategori */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pengeluaran per Kategori */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Pengeluaran per Kategori</h3>
              <p className="text-xs text-slate-400">Distribusi pengeluaran berdasarkan pos beban</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
              Beban Kas
            </span>
          </div>

          {Object.keys(summary?.expense_by_category || {}).length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
                <FolderOpen className="w-5 h-5 stroke-[1.5]" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Belum ada pengeluaran</p>
              <p className="text-xs text-slate-400 mt-0.5">Transaksi pengeluaran periode ini masih kosong</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(summary.expense_by_category).map(([cat, amt], idx) => {
                const percent = summary.total_expense > 0 ? (amt / summary.total_expense) * 100 : 0;
                const style = CATEGORY_STYLES[idx % CATEGORY_STYLES.length];
                return (
                  <div key={cat} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${style.bar}`} />
                        <span className="font-medium capitalize text-slate-700">{cat}</span>
                        <span className="text-xs text-slate-400">
                          ({percent.toFixed(1)}%)
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">{formatRupiah(amt)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${style.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pemasukan per Kategori */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Pemasukan per Kategori</h3>
              <p className="text-xs text-slate-400">Distribusi pendapatan dari berbagai sumber</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Sumber Masuk
            </span>
          </div>

          {Object.keys(summary?.income_by_category || {}).length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
                <FolderOpen className="w-5 h-5 stroke-[1.5]" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Belum ada pemasukan</p>
              <p className="text-xs text-slate-400 mt-0.5">Transaksi pemasukan periode ini masih kosong</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(summary.income_by_category).map(([cat, amt], idx) => {
                const percent = summary.total_income > 0 ? (amt / summary.total_income) * 100 : 0;
                const style = CATEGORY_STYLES[(idx + 3) % CATEGORY_STYLES.length];
                return (
                  <div key={cat} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${style.bar}`} />
                        <span className="font-medium capitalize text-slate-700">{cat}</span>
                        <span className="text-xs text-slate-400">
                          ({percent.toFixed(1)}%)
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">{formatRupiah(amt)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${style.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5 Transaksi Terakhir */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">5 Transaksi Terakhir</h3>
            <p className="text-xs text-slate-400">Aktivitas keuangan paling mutakhir</p>
          </div>
          <Link
            to="/transactions"
            className="text-xs font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 group transition"
          >
            <span>Semua Transaksi</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">Belum ada riwayat transaksi</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.map((trx) => {
              const isIncome = trx.type === "income";
              const partyInitial = (trx.party || "T")[0].toUpperCase();
              return (
                <div key={trx.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/60 px-2 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isIncome
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-rose-50 text-rose-700 border border-rose-200/60"
                      }`}
                    >
                      {partyInitial}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{trx.party || "Tanpa Nama"}</p>
                      <p className="text-xs text-slate-400">
                        {trx.trx_date || "Tanggal -"} &bull; <span className="capitalize">{trx.category_name || "Lainnya"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        isIncome ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {isIncome ? "+" : "-"} {formatRupiah(trx.amount, trx.currency_code)}
                    </p>
                    {trx.payment_method && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium inline-block mt-0.5">
                        {trx.payment_method}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
