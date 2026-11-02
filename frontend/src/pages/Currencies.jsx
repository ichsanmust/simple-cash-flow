import React, { useEffect, useState } from "react";
import { Coins, Loader2, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { currenciesApi } from "../api/client";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

export default function Currencies() {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    symbol: "",
    decimal_places: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const loadCurrencies = async () => {
    setLoading(true);
    try {
      const data = await currenciesApi.list(true); // sertakan yang nonaktif
      setCurrencies(data);
    } catch (err) {
      addToast(err.message || "Gagal memuat mata uang", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrencies();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await currenciesApi.create({
        ...form,
        code: form.code.toUpperCase(),
        decimal_places: Number(form.decimal_places),
      });
      addToast(`Mata uang '${form.code.toUpperCase()}' berhasil ditambahkan!`);
      setModalOpen(false);
      setForm({ code: "", name: "", symbol: "", decimal_places: 0 });
      loadCurrencies();
    } catch (err) {
      addToast(err.message || "Gagal menambahkan mata uang", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (curr) => {
    try {
      await currenciesApi.update(curr.code, { is_active: !curr.is_active });
      addToast(`Status mata uang '${curr.code}' berhasil diperbarui`);
      loadCurrencies();
    } catch (err) {
      addToast(err.message || "Gagal mengubah status mata uang", "error");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kelola Mata Uang</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Daftar mata uang yang didukung dalam pencatatan transaksi
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Mata Uang</span>
        </button>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Kode (ISO)</th>
                  <th className="py-3.5 px-6">Nama</th>
                  <th className="py-3.5 px-6">Simbol</th>
                  <th className="py-3.5 px-6">Desimal</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currencies.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-bold text-slate-800 text-xs">{c.code}</td>
                    <td className="py-4 px-6 text-slate-700">{c.name}</td>
                    <td className="py-4 px-6 text-slate-700 font-semibold">{c.symbol}</td>
                    <td className="py-4 px-6 text-slate-500">{c.decimal_places} desimal</td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {c.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleToggle(c)}
                        className={`p-1.5 rounded-lg transition inline-flex items-center gap-1 text-xs font-medium ${
                          c.is_active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {c.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        <span>{c.is_active ? "Nonaktifkan" : "Aktifkan"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Mata Uang Baru">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kode ISO (3 Huruf)
              </label>
              <input
                type="text"
                required
                maxLength={3}
                placeholder="USD"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Simbol
              </label>
              <input
                type="text"
                required
                placeholder="$"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Mata Uang
            </label>
            <input
              type="text"
              required
              placeholder="US Dollar"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Jumlah Desimal (IDR=0, USD=2)
            </label>
            <input
              type="number"
              min={0}
              max={4}
              value={form.decimal_places}
              onChange={(e) => setForm({ ...form, decimal_places: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              {submitting ? "Menyimpan..." : "Simpan Mata Uang"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

