import React from "react";
import { formatRupiah } from "../api/client";

export default function SummaryCard({
  title,
  amount,
  icon: Icon,
  color = "indigo",
  subtitle,
  badge,
}) {
  const isDarkHero = color === "indigo";

  if (isDarkHero) {
    const isPositive = (amount ?? 0) >= 0;
    return (
      <div className="relative overflow-hidden bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg shadow-slate-900/10 flex flex-col justify-between group hover:border-slate-700 transition-all">
        {/* Subtle decorative background watermark */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-slate-800/40 pointer-events-none blur-xl group-hover:scale-110 transition-transform" />
        <svg
          className="absolute right-3 bottom-3 w-24 h-24 text-slate-800/50 pointer-events-none"
          fill="none"
          viewBox="0 0 100 100"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M10 80 Q 40 20, 90 60" />
          <path d="M20 90 Q 55 35, 95 70" opacity="0.4" />
        </svg>

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full ${isPositive ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`} />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {title}
              </p>
            </div>
            <h4 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {formatRupiah(amount)}
            </h4>
          </div>
          <div className="p-3 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-inner">
            <Icon className="w-5 h-5" />
          </div>
        </div>

        <div className="relative z-10 mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>{subtitle || "Arus kas bersih"}</span>
          <span className={`px-2 py-0.5 rounded-full font-semibold ${isPositive ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
            {isPositive ? "Surplus Kas" : "Defisit Kas"}
          </span>
        </div>
      </div>
    );
  }

  const colorThemes = {
    emerald: {
      accentBar: "bg-emerald-500",
      iconBox: "bg-emerald-50 text-emerald-600 border-emerald-200/80 ring-4 ring-emerald-50/50",
      watermark: "text-emerald-500/10",
      badgeText: "text-emerald-700 bg-emerald-50 border-emerald-200/60",
    },
    rose: {
      accentBar: "bg-rose-500",
      iconBox: "bg-rose-50 text-rose-600 border-rose-200/80 ring-4 ring-rose-50/50",
      watermark: "text-rose-500/10",
      badgeText: "text-rose-700 bg-rose-50 border-rose-200/60",
    },
    amber: {
      accentBar: "bg-amber-500",
      iconBox: "bg-amber-50 text-amber-600 border-amber-200/80 ring-4 ring-amber-50/50",
      watermark: "text-amber-500/10",
      badgeText: "text-amber-700 bg-amber-50 border-amber-200/60",
    },
  };

  const theme = colorThemes[color] || colorThemes.emerald;

  return (
    <div className="relative overflow-hidden bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group">
      {/* Delicate corner watermark SVG */}
      <svg
        className={`absolute -right-4 -bottom-4 w-28 h-28 ${theme.watermark} pointer-events-none group-hover:scale-110 transition-transform`}
        fill="none"
        viewBox="0 0 100 100"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="50" cy="50" r="40" />
        <circle cx="50" cy="50" r="28" strokeDasharray="3 3" />
      </svg>

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-1.5 h-3.5 rounded-full ${theme.accentBar}`} />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </p>
          </div>
          <h4 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {formatRupiah(amount)}
          </h4>
        </div>
        <div className={`p-3 rounded-xl border ${theme.iconBox} shadow-xs`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="relative z-10 mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>{subtitle || "Terkonfirmasi"}</span>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full font-semibold border ${theme.badgeText}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
