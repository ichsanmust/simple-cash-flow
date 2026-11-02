import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  aiModelsApi,
  categoriesApi,
  expensesApi,
  formatNumberWithDots,
  formatRupiah,
  parseNumberFromDots,
} from "../api/client";
import { useToast } from "../components/Toast";
import { formatLocalDate } from "../utils/date";

export default function AddExpense() {
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState("ai"); // 'ai' | 'manual'
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [draftData, setDraftData] = useState(null);
  const [activeModel, setActiveModel] = useState(null);
  const [formData, setFormData] = useState({
    trx_date: formatLocalDate(),
    party: "",
    category_id: "",
    amount: "",
    payment_method: "Online",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const fileInputRef = useRef(null);
  const manualFileInputRef = useRef(null);

  const resetForm = () => {
    setDraftData(null);
    setFile(null);
    setPreviewUrl(null);
    setErrorMessage("");
    setFormData({
      trx_date: formatLocalDate(),
      party: "",
      category_id: categories[0]?.id || "",
      amount: "",
      payment_method: "Online",
      description: "",
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (manualFileInputRef.current) manualFileInputRef.current.value = "";
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [cats, modelInfo] = await Promise.all([
          categoriesApi.list("expense"),
          aiModelsApi.getActive().catch(() => null),
        ]);
        if (cats.length === 0) {
          addToast("Anda belum memiliki kategori pengeluaran. Silakan buat atau muat kategori terlebih dahulu.", "info");
          navigate("/categories?first_time=true");
          return;
        }
        setCategories(cats);
        if (modelInfo) setActiveModel(modelInfo);
        if (cats.length > 0 && !formData.category_id) {
          setFormData((prev) => ({ ...prev, category_id: cats[0].id }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadInitialData();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setErrorMessage("");
      if (selected.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      addToast("Pilih foto struk/invoice terlebih dahulu", "error");
      return;
    }

    setErrorMessage("");
    setAnalyzing(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const draft = await expensesApi.upload(fd);
      setDraftData(draft);
      setFormData({
        trx_date: draft.trx_date || formatLocalDate(),
        party: draft.party?.trim() ? draft.party.trim() : "Lainnya - Periksa lagi Nanti",
        category_id: draft.category_id || (categories[0]?.id || ""),
        amount: draft.amount || "",
        payment_method: draft.payment_method || "Online",
        description: draft.description || "",
      });
      addToast("AI berhasil menganalisis struk! Silakan review dan konfirmasi.");
    } catch (err) {
      const msg = err.message || "Gagal memproses struk dengan AI";
      setErrorMessage(msg);
      addToast(msg, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmDraft = async (e) => {
    e.preventDefault();
    if (!draftData) {
      addToast("Silakan upload dan ekstrak struk terlebih dahulu", "error");
      return;
    }

    if (!formData.party?.trim()) {
      addToast("Nama Toko / Vendor tidak boleh kosong", "error");
      return;
    }

    const cleanAmount = parseNumberFromDots(formData.amount);
    if (!cleanAmount || cleanAmount <= 0) {
      addToast("Nominal harus berupa angka lebih besar dari 0", "error");
      return;
    }

    const cleanCategoryId = Number(formData.category_id);
    if (!cleanCategoryId || isNaN(cleanCategoryId)) {
      addToast("Silakan pilih kategori pengeluaran", "error");
      return;
    }

    setSubmitting(true);
    try {
      await expensesApi.confirm(draftData.id, {
        trx_date: formData.trx_date,
        party: formData.party.trim(),
        category_id: cleanCategoryId,
        amount: cleanAmount,
        currency_code: "IDR",
        payment_method: formData.payment_method?.trim() || "Online",
        description: formData.description?.trim() || null,
      });
      addToast("Pengeluaran berhasil dikonfirmasi dan dicatat ke kas!");
      resetForm();
    } catch (err) {
      addToast(err.message || "Gagal mengonfirmasi pengeluaran", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();

    if (!formData.party?.trim()) {
      addToast("Nama Toko / Penerima tidak boleh kosong", "error");
      return;
    }

    const cleanAmount = parseNumberFromDots(formData.amount);
    if (!cleanAmount || cleanAmount <= 0) {
      addToast("Nominal harus berupa angka lebih besar dari 0", "error");
      return;
    }

    const cleanCategoryId = Number(formData.category_id);
    if (!cleanCategoryId || isNaN(cleanCategoryId)) {
      addToast("Silakan pilih kategori pengeluaran", "error");
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append("trx_date", formData.trx_date);
    fd.append("party", formData.party.trim());
    fd.append("category_id", cleanCategoryId);
    fd.append("amount", cleanAmount);
    fd.append("currency_code", "IDR");
    fd.append("payment_method", formData.payment_method?.trim() || "Online");
    if (formData.description?.trim()) fd.append("description", formData.description.trim());
    if (file) fd.append("attachment", file);

    try {
      await expensesApi.createManual(fd);
      addToast("Pengeluaran manual berhasil disimpan ke kas!");
      resetForm();
    } catch (err) {
      addToast(err.message || "Gagal menyimpan pengeluaran", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tambah Pengeluaran</h1>
          <p className="text-sm text-slate-500 mt-0.5">Unggah foto struk untuk diekstrak otomatis oleh AI atau input manual</p>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-xs self-start">
          <button
            onClick={() => setActiveTab("ai")}
            disabled={analyzing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 ${
              activeTab === "ai"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Ekstraksi AI (Rekomendasi)</span>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            disabled={analyzing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 ${
              activeTab === "manual"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Input Biasa</span>
          </button>
        </div>
      </div>

      {/* Alert Error Analisis AI */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Gagal Menganalisis Struk dengan AI</p>
            <p className="text-xs text-rose-700 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {activeTab === "ai" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sisi Kiri: Upload Foto Struk */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] space-y-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-slate-700" />
                <span>Foto Struk / Invoice</span>
              </h3>

              <div
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center min-h-[220px] ${
                  analyzing
                    ? "border-slate-300 bg-slate-100/70 opacity-80 cursor-not-allowed"
                    : "border-slate-200 hover:border-slate-400 bg-slate-50/50"
                }`}
              >
                {analyzing && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center gap-2 z-10 p-4">
                    <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
                    <p className="text-xs font-bold text-slate-900">Sedang memproses struk dengan AI...</p>
                    <p className="text-xs text-slate-500">Mohon tunggu sebentar (maks. 30 detik)</p>
                  </div>
                )}

                {previewUrl ? (
                  <div className="space-y-3">
                    <img
                      src={previewUrl}
                      alt="Preview struk"
                      className="max-h-52 mx-auto rounded-xl object-contain shadow-sm"
                    />
                    <p className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
                      {file?.name}
                    </p>
                  </div>
                ) : file ? (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 text-slate-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">PDF Document</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">Pilih foto atau ambil dengan kamera</p>
                    <p className="text-xs text-slate-400">JPG, PNG, WEBP, atau PDF (maks. 5MB)</p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  disabled={analyzing}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className={`absolute inset-0 opacity-0 ${analyzing ? "cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
                />
              </div>

              <button
                type="button"
                disabled={!file || analyzing}
                onClick={handleUploadAndAnalyze}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 text-sm"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menganalisis dengan {activeModel?.name || "AI"}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Ekstrak Data Struk</span>
                  </>
                )}
              </button>

              {activeModel && (
                <p className="text-xs text-center text-slate-400 font-medium">
                  Didukung oleh: <span className="font-semibold text-slate-600">{activeModel.name}</span>
                </p>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Form Review & Konfirmasi */}
          <div className="lg:col-span-7">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-slate-100">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-900 text-base">Hasil Ekstraksi & Konfirmasi</h3>
                  <p className="text-xs text-slate-500">
                    {draftData
                      ? "Periksa dan koreksi data sebelum disimpan sebagai transaksi final"
                      : "Unggah struk terlebih dahulu untuk mengisi data secara otomatis"}
                  </p>
                </div>
                {draftData ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs shrink-0 self-start sm:self-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Draft #{draftData.id}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200/70 shrink-0 self-start sm:self-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Menunggu Struk</span>
                  </span>
                )}
              </div>

              <form onSubmit={handleConfirmDraft} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.trx_date}
                      onChange={(e) => setFormData({ ...formData, trx_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Metode Pembayaran
                    </label>
                    <input
                      type="text"
                      placeholder="Online"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {["Online", "QRIS", "Transfer", "Cash"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFormData({ ...formData, payment_method: m })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            formData.payment_method?.toLowerCase() === m.toLowerCase()
                              ? "bg-slate-900 border-slate-900 text-white font-bold"
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
                    Nama Toko / Vendor
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Indomaret / Rumah Makan Padang"
                    value={formData.party}
                    onChange={(e) => setFormData({ ...formData, party: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Kategori
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none bg-white capitalize"
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
                      Nominal Total (Rp)
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
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
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
                    Ringkasan Item / Catatan
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Makan siang 3 porsi + teh manis"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/drafts")}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Batal / Lihat Drafts
                  </button>
                  <button
                    type="submit"
                    disabled={!draftData || submitting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Konfirmasi & Simpan Kas</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Tab Input Manual */
        <div className="max-w-2xl mx-auto bg-white/90 backdrop-blur-sm rounded-2xl p-8 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)]">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={formData.trx_date}
                  onChange={(e) => setFormData({ ...formData, trx_date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Metode Pembayaran
                </label>
                <input
                  type="text"
                  placeholder="Online"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {["Online", "QRIS", "Transfer", "Cash"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormData({ ...formData, payment_method: m })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        formData.payment_method?.toLowerCase() === m.toLowerCase()
                          ? "bg-slate-900 border-slate-900 text-white font-bold"
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
                Nama Toko / Penerima
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: PLN / SPBU Pertamina"
                value={formData.party}
                onChange={(e) => setFormData({ ...formData, party: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none bg-white capitalize"
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
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
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
                Catatan / Keterangan
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Isi bensin mobil kantor"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lampiran Bukti (Opsional)
              </label>
              <input
                ref={manualFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition flex items-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Simpan Pengeluaran</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

