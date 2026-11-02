import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpCircle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import {
  categoriesApi,
  formatNumberWithDots,
  formatRupiah,
  incomesApi,
  parseNumberFromDots,
} from "../api/client";
import { useToast } from "../components/Toast";

export default function AddIncome() {
  const [categories, setCategories] = useState([]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [formData, setFormData] = useState({
    trx_date: new Date().toISOString().split("T")[0],
    party: "",
    category_id: "",
    amount: "",
    payment_method: "Transfer BCA",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await categoriesApi.list("income");
        if (cats.length === 0) {
          addToast("Anda belum memiliki kategori pemasukan. Silakan buat atau muat kategori terlebih dahulu.", "info");
          navigate("/categories?first_time=true");
          return;
        }
        setCategories(cats);
        if (cats.length > 0 && !formData.category_id) {
          setFormData((prev) => ({ ...prev, category_id: cats[0].id }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadCategories();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (selected.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.party?.trim()) {
      addToast("Sumber Dana tidak boleh kosong", "error");
      return;
    }

    const cleanAmount = parseNumberFromDots(formData.amount);
    if (!cleanAmount || cleanAmount <= 0) {
      addToast("Nominal harus berupa angka lebih besar dari 0", "error");
      return;
    }

    const cleanCategoryId = Number(formData.category_id);
    if (!cleanCategoryId || isNaN(cleanCategoryId)) {
      addToast("Silakan pilih kategori pemasukan", "error");
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append("trx_date", formData.trx_date);
    fd.append("party", formData.party.trim());
    fd.append("category_id", cleanCategoryId);
    fd.append("amount", cleanAmount);
    fd.append("currency_code", "IDR");
    if (formData.payment_method?.trim()) fd.append("payment_method", formData.payment_method.trim());
    if (formData.description?.trim()) fd.append("description", formData.description.trim());
    if (file) fd.append("attachment", file);

    try {
      await incomesApi.create(fd);
      addToast("Pemasukan berhasil dicatat!");
      navigate("/transactions");
    } catch (err) {
      addToast(err.message || "Gagal mencatat pemasukan", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Catat Pemasukan</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Formulir manual untuk mencatat pemasukan. Data dan lampiran tersimpan aman secara lokal tanpa diproses oleh pihak ketiga.
        </p>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tanggal Pemasukan
              </label>
              <input
                type="date"
                required
                value={formData.trx_date}
                onChange={(e) => setFormData({ ...formData, trx_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Metode Pembayaran
              </label>
              <input
                type="text"
                placeholder="Contoh: Transfer Mandiri / Tunai"
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {["Transfer BCA", "Transfer Mandiri", "Online", "Cash"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFormData({ ...formData, payment_method: m })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                      formData.payment_method?.toLowerCase() === m.toLowerCase()
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Sumber Dana / Pembayar
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Gaji Kantor PT XYZ / Pembayaran Klien"
              value={formData.party}
              onChange={(e) => setFormData({ ...formData, party: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kategori Pemasukan
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none bg-white capitalize"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="capitalize">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nominal (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="0"
                  value={formatNumberWithDots(formData.amount)}
                  onChange={(e) => {
                    const num = parseNumberFromDots(e.target.value);
                    setFormData({ ...formData, amount: num === 0 && e.target.value === "" ? "" : num });
                  }}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>
              {Boolean(formData.amount) && (
                <p className="text-xs font-semibold text-emerald-600 mt-1">
                  Terbaca: {formatRupiah(formData.amount)}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Keterangan / Catatan
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Gaji pokok bulan Oktober + insentif lembur"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
            />
          </div>

          {/* Lampiran Opsional */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Lampiran Bukti Transfer / Slip Gaji (Opsional)
            </label>
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              {previewUrl ? (
                <div className="flex items-center gap-4">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-xl border shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{file?.name}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setPreviewUrl(null);
                      }}
                      className="text-xs text-rose-600 hover:underline mt-1 font-medium"
                    >
                      Hapus Foto
                    </button>
                  </div>
                </div>
              ) : file ? (
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-emerald-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{file.name}</p>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-xs text-rose-600 hover:underline mt-1 font-medium"
                    >
                      Hapus File
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Format: JPG, PNG, WEBP, atau PDF (maks. 5MB). File ini disimpan terlindung dan hanya dapat diakses oleh Anda.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/transactions")}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Simpan Pemasukan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

