import React, { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  const location = useLocation();
  const isExcelView = location.pathname === "/transactions-excel";

  return (
    <div className="min-h-screen flex flex-col text-slate-800">
      <Navbar />
      <main
        className={`flex-1 w-full mx-auto transition-all ${
          isExcelView
            ? "max-w-none px-3 sm:px-5 lg:px-6 py-4"
            : "max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        }`}
      >
        <Suspense
          fallback={
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-900/20 border-t-slate-900 rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold text-slate-500">Memuat halaman...</p>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-slate-200/70 bg-white/60 backdrop-blur-sm py-4 text-center text-xs text-slate-400">
        Simple Cashflow &copy; 2026 &bull; Multi-User &bull; OpenRouter AI Vision
      </footer>
    </div>
  );
}
