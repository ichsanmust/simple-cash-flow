import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Cpu,
  FileText,
  Folder,
  HardDrive,
  Key,
  Loader2,
  Save,
  Settings as SettingsIcon,
  Shield,
  Zap,
} from "lucide-react";
import { settingsApi } from "../api/client";
import { useToast } from "../components/Toast";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    ai_daily_limit_per_user: 20,
    upload_dir: "uploads",
    max_upload_mb: 5,
    openrouter_api_key: "",
  });
  const [serverSettings, setServerSettings] = useState(null);
  const { addToast } = useToast();

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      setServerSettings(data);
      setForm({
        ai_daily_limit_per_user: data.ai_daily_limit_per_user ?? 20,
        upload_dir: data.upload_dir || "uploads",
        max_upload_mb: data.max_upload_mb ?? 5,
        openrouter_api_key: "",
      });
    } catch (err) {
      addToast(err.message || "Gagal memuat pengaturan sistem", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ai_daily_limit_per_user: Number(form.ai_daily_limit_per_user),
        upload_dir: form.upload_dir.trim(),
        max_upload_mb: Number(form.max_upload_mb),
      };
      if (form.openrouter_api_key.trim()) {
        payload.openrouter_api_key = form.openrouter_api_key.trim();
      }

      const res = await settingsApi.update(payload);
      setServerSettings(res);
      setForm((prev) => ({ ...prev, openrouter_api_key: "" }));
      addToast("Pengaturan sistem berhasil disimpan ke database!");
    } catch (err) {
      addToast(err.message || "Gagal menyimpan pengaturan", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            Konfigurasi Sistem
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-white rounded-xl shadow-xs">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <span>Pengaturan Sistem</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kelola batasan upload berkas, direktori penyimpanan lokal, dan kuota analisis AI
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Berkas & Penyimpanan */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] p-6 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Penyimpanan & Unggahan Berkas</h2>
              <p className="text-xs text-slate-400">Atur path folder fisik dan ukuran maksimum dokumen</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Direktori Penyimpanan Unggahan
              </label>
              <div className="relative">
                <Folder className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={form.upload_dir}
                  onChange={(e) => setForm({ ...form, upload_dir: e.target.value })}
                  placeholder="uploads"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none transition"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Folder lokal tempat bukti struk & slip transaksi disimpan (dipisahkan per ID pengguna).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Maksimal Ukuran Berkas (MB)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={form.max_upload_mb}
                  onChange={(e) => setForm({ ...form, max_upload_mb: e.target.value })}
                  className="w-full pl-3.5 pr-12 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none transition"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  MB
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Batas maksimal ukuran foto nota atau PDF yang dapat diunggah pengguna.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Batas Kuota AI */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] p-6 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Batas Kuota Penggunaan AI</h2>
              <p className="text-xs text-slate-400">Cegah lonjakan biaya pemanggilan model vision per user</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Batas Harian Ekstraksi Struk per Pengguna
            </label>
            <div className="relative max-w-xs">
              <input
                type="number"
                min="1"
                max="500"
                required
                value={form.ai_daily_limit_per_user}
                onChange={(e) => setForm({ ...form, ai_daily_limit_per_user: e.target.value })}
                className="w-full pl-3.5 pr-28 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none transition"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                struk / hari
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Jumlah maksimal transaksi struk yang dapat diproses oleh AI dalam rentang 1 hari per akun user.
            </p>
          </div>
        </div>

        {/* Card 3: Integrasi AI & Model Aktif (Ringkasan) */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Integrasi Gateway AI (OpenRouter)</h2>
                <p className="text-xs text-slate-400">Penyedia model vision multi-provider</p>
              </div>
            </div>
            <Link
              to="/admin/ai-models"
              className="text-xs font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 group transition"
            >
              <span>Katalog Model</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
              <p className="text-xs font-medium text-slate-500">Model AI Aktif Saat Ini</p>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {serverSettings?.active_model_name || "Google Gemini 2.5 Flash"}
              </p>
              <code className="text-xs font-mono text-slate-500 mt-1 block">
                {serverSettings?.active_model_id || "google/gemini-2.5-flash"}
              </code>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
              <p className="text-xs font-medium text-slate-500">Status API Key OpenRouter</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    serverSettings?.has_openrouter_api_key
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                      : "bg-amber-50 text-amber-700 border border-amber-200/80"
                  }`}
                >
                  {serverSettings?.has_openrouter_api_key ? "Terkonfigurasi di DB" : "Belum Diisi"}
                </span>
                {serverSettings?.openrouter_api_key_masked && (
                  <span className="text-xs font-mono text-slate-600">
                    {serverSettings.openrouter_api_key_masked}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ganti / Perbarui API Key OpenRouter (Opsional)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="Biarkan kosong jika tidak ingin mengubah key"
                value={form.openrouter_api_key}
                onChange={(e) => setForm({ ...form, openrouter_api_key: e.target.value })}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow active:scale-[0.98] transition-all flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
}
