import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CircleDollarSign, Lock, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { categoriesApi } from "../api/client";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      try {
        const catCheck = await categoriesApi.check();
        if (!catCheck.has_categories) {
          navigate("/categories?first_time=true");
          return;
        }
      } catch (catErr) {
        console.error("Gagal memeriksa kategori user:", catErr);
      }
      navigate("/");
    } catch (err) {
      setError(err.message || "Gagal masuk. Periksa kembali User ID dan password Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-slate-200/80">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 bg-slate-900 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm ring-1 ring-slate-800">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Simple<span className="text-emerald-600">Cashflow</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">Masuk untuk mengelola arus kas Anda</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              User ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: admin"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 text-sm mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Masuk Sekarang"
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400">
            Akun pengguna dibuat oleh Administrator sistem.
          </p>
        </div>
      </div>
    </div>
  );
}

