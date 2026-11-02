import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { authApi } from "../api/client";
import { useToast } from "../components/Toast";

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast("Password baru dan konfirmasi tidak cocok", "error");
      return;
    }
    if (newPassword.length < 6) {
      addToast("Password minimal 6 karakter", "error");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      addToast("Password berhasil diperbarui!");
      navigate("/");
    } catch (err) {
      addToast(err.message || "Gagal mengubah password", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ganti Password</h1>
        <p className="text-sm text-slate-500 mt-1">Perbarui kata sandi akun Anda secara berkala</p>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password Lama
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Simpan Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

