import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, CheckCircle2, Eye, FileText, Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  categoriesApi,
  expensesApi,
  formatNumberWithDots,
  formatRupiah,
  parseNumberFromDots,
  transactionsApi,
} from "../api/client";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";
import { formatLocalDate } from "../utils/date";

export default function Drafts() {
  const [drafts, setDrafts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState(null);
  const [previewAttachmentType, setPreviewAttachmentType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const { addToast } = useToast();

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const [draftsList, catList] = await Promise.all([
        expensesApi.getDrafts(),
        categoriesApi.list("expense"),
      ]);
      setDrafts(draftsList);
      setCategories(catList);
    } catch (err) {
      addToast(err.message || "Gagal memuat daftar draft", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const handleOpenReview = (draft) => {
    setSelectedDraft(draft);
    setEditForm({
      trx_date: draft.trx_date || formatLocalDate(),
      party: draft.party?.trim() ? draft.party.trim() : "Lainnya - Periksa lagi Nanti",
      category_id: draft.category_id || (categories[0]?.id || ""),
      amount: draft.amount || "",
      payment_method: draft.payment_method || "Online",
      description: draft.description || "",
    });
  };

  const handlePreviewFile = async (draft) => {
    if (!draft.has_attachment) return;
    try {
      const blob = await transactionsApi.getAttachmentBlob(draft.id);
      const url = URL.createObjectURL(blob);
      setPreviewAttachmentUrl(url);
      setPreviewAttachmentType(draft.attachment_mime || "");
    } catch (err) {
      addToast(err.message || "Gagal memuat file lampiran", "error");
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!selectedDraft || !editForm) return;

    if (!editForm.party?.trim()) {
      addToast("Nama Toko / Vendor tidak boleh kosong", "error");
      return;
    }

    const cleanAmount = parseNumberFromDots(editForm.amount);
    if (!cleanAmount || cleanAmount <= 0) {
      addToast("Nominal harus berupa angka lebih besar dari 0", "error");
      return;
    }

    const cleanCategoryId = Number(editForm.category_id);
    if (!cleanCategoryId || isNaN(cleanCategoryId)) {
      addToast("Silakan pilih kategori pengeluaran", "error");
      return;
    }

    setSubmitting(true);
    try {
      await expensesApi.confirm(selectedDraft.id, {
        trx_date: editForm.trx_date,
        party: editForm.party.trim(),
        category_id: cleanCategoryId,
        amount: cleanAmount,
        currency_code: "IDR",
        payment_method: editForm.payment_method?.trim() || "Online",
        description: editForm.description?.trim() || null,
      });
      addToast("Draft pengeluaran berhasil dikonfirmasi!");
      setSelectedDraft(null);
      loadDrafts();
    } catch (err) {
      addToast(err.message || "Gagal mengonfirmasi draft", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus draft struk ini?")) return;
    try {
      await transactionsApi.delete(id);
      addToast("Draft berhasil dihapus");
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      addToast(err.message || "Gagal menghapus draft", "error");
    }
  };

  const handleApproveAll = async () => {
    if (drafts.length === 0) return;
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menyetujui (approve) semua ${drafts.length} draft pengeluaran sekaligus?`
      )
    ) {
      return;
    }

    setApprovingAll(true);
    try {
      const res = await expensesApi.confirmAll();
      addToast(res.message, res.skipped_count > 0 ? "warning" : "success");
      loadDrafts();
    } catch (err) {
      addToast(err.message || "Gagal menyetujui semua draft", "error");
    } finally {
      setApprovingAll(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Draft Pengeluaran (AI)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Daftar struk yang telah diproses AI namun belum dikonfirmasi masuk ke buku kas
          </p>
        </div>

        {drafts.length > 0 && (
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={approvingAll || loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs disabled:opacity-50"
          >
            {approvingAll ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <CheckCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span>Approve Semua Draft ({drafts.length})</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-12 text-center border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Semua Draft Selesai</h3>
          <p className="text-sm text-slate-500">
            Tidak ada pengeluaran draft yang tertunda. Semua struk telah dikonfirmasi ke buku kas.
          </p>
          <Link
            to="/expenses/add"
            className="inline-block px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-slate-800 transition"
          >
            Upload Struk Baru
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Draft AI</span>
                  </span>
                  <span className="text-xs text-slate-400">{d.trx_date || "Tanggal -"}</span>
                </div>

                <h4 className="font-bold text-slate-900 text-base line-clamp-1">
                  {d.party || "Lainnya - Periksa lagi Nanti"}
                </h4>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {d.amount ? formatRupiah(d.amount) : "Rp -"}
                </p>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                  {d.description || "Tidak ada deskripsi"}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {d.has_attachment && (
                    <button
                      onClick={() => handlePreviewFile(d)}
                      title="Lihat Foto Struk"
                      className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(d.id)}
                    title="Hapus Draft"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => handleOpenReview(d)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Review & Konfirmasi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Review Draft */}
      <Modal
        isOpen={Boolean(selectedDraft)}
        onClose={() => setSelectedDraft(null)}
        title={`Review Draft Pengeluaran #${selectedDraft?.id}`}
      >
        {editForm && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={editForm.trx_date}
                  onChange={(e) => setEditForm({ ...editForm, trx_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Metode Pembayaran
                </label>
                <input
                  type="text"
                  placeholder="Online"
                  value={editForm.payment_method}
                  onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {["Online", "QRIS", "Transfer", "Cash"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, payment_method: m })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        editForm.payment_method?.toLowerCase() === m.toLowerCase()
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
                Vendor / Nama Toko
              </label>
              <input
                type="text"
                required
                value={editForm.party}
                onChange={(e) => setEditForm({ ...editForm, party: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori
                </label>
                <select
                  value={editForm.category_id}
                  onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white capitalize transition"
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={formatNumberWithDots(editForm.amount)}
                    onChange={(e) => {
                      const num = parseNumberFromDots(e.target.value);
                      setEditForm({ ...editForm, amount: num === 0 && e.target.value === "" ? "" : num });
                    }}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                  />
                </div>
                {Boolean(editForm.amount) && (
                  <p className="text-xs font-semibold text-emerald-600 mt-1">
                    Terbaca: {formatRupiah(editForm.amount)}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deskripsi
              </label>
              <textarea
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedDraft(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Konfirmasi Sekarang</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Preview Lampiran */}
      <Modal
        isOpen={Boolean(previewAttachmentUrl)}
        onClose={() => {
          if (previewAttachmentUrl) URL.revokeObjectURL(previewAttachmentUrl);
          setPreviewAttachmentUrl(null);
        }}
        title="Bukti Struk Pembelian"
      >
        <div className="flex justify-center p-2">
          {previewAttachmentType === "application/pdf" ? (
            <iframe src={previewAttachmentUrl} title="PDF Preview" className="w-full h-[65vh] rounded-xl border" />
          ) : (
            <img src={previewAttachmentUrl} alt="Struk" className="max-h-[65vh] object-contain rounded-xl shadow" />
          )}
        </div>
      </Modal>
    </div>
  );
}

