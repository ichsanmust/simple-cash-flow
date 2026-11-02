import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  Eye,
  Filter,
  Loader2,
  Paperclip,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { categoriesApi, formatRupiah, transactionsApi } from "../api/client";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Preview Lampiran Modal
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const { addToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [trxList, catList] = await Promise.all([
        transactionsApi.list({
          type: filterType || undefined,
          status: filterStatus || undefined,
          category_id: filterCategory || undefined,
          search: filterSearch || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        categoriesApi.list(),
      ]);
      setTransactions(trxList);
      setCategories(catList);
    } catch (err) {
      addToast(err.message || "Gagal memuat transaksi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterType, filterStatus, filterCategory, dateFrom, dateTo]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handlePreviewAttachment = async (trx) => {
    try {
      const blob = await transactionsApi.getAttachmentBlob(trx.id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewMime(trx.attachment_mime);
      setPreviewTitle(`Bukti: ${trx.party || "Transaksi"} (#${trx.id})`);
    } catch (err) {
      addToast(err.message || "Gagal memuat file lampiran", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) return;
    try {
      await transactionsApi.delete(id);
      addToast("Transaksi berhasil dihapus");
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      addToast(err.message || "Gagal menghapus transaksi", "error");
    }
  };

  // Inline Edit Pihak / Keterangan
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ party: "", description: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (trx) => {
    setEditingId(trx.id);
    setEditForm({
      party: trx.party || "",
      description: trx.description || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ party: "", description: "" });
  };

  const handleSaveEdit = async (id) => {
    const cleanParty = String(editForm.party || "").trim();
    if (!cleanParty) {
      addToast("Nama Pihak / Toko tidak boleh kosong", "error");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await transactionsApi.update(id, {
        party: cleanParty,
        description: String(editForm.description || "").trim() || null,
      });
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, party: updated.party, description: updated.description }
            : t
        )
      );
      addToast("Pihak & keterangan berhasil diperbarui");
      setEditingId(null);
    } catch (err) {
      addToast(err.message || "Gagal memperbarui transaksi", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Riwayat Transaksi</h1>
          <p className="text-sm text-slate-500 mt-1">Semua pemasukan dan pengeluaran Anda</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/expenses/add"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            + Pengeluaran
          </Link>
          <Link
            to="/incomes/add"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            + Pemasukan
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Cari toko, sumber dana, atau deskripsi..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none transition"
            >
              <option value="">Semua Tipe</option>
              <option value="income">Pemasukan (+)</option>
              <option value="expense">Pengeluaran (-)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none transition"
            >
              <option value="">Semua Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="draft">Draft</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none capitalize transition"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="capitalize">
                  {c.name} ({c.type})
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-xs"
            >
              Terapkan
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span className="font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Rentang Tanggal:
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none"
          />
          <span>s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none"
          />
          {(filterType || filterStatus || filterCategory || filterSearch || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setFilterType("");
                setFilterStatus("");
                setFilterCategory("");
                setFilterSearch("");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs text-rose-600 hover:underline font-semibold ml-auto"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Tabel Transaksi */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
              <Filter className="w-5 h-5 stroke-[1.5]" />
            </div>
            <p className="text-xs font-semibold text-slate-700">Tidak ada transaksi ditemukan</p>
            <p className="text-xs text-slate-400 mt-0.5">Sesuaikan filter atau tambahkan transaksi baru</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Tanggal</th>
                  <th className="py-3.5 px-6">Pihak / Keterangan</th>
                  <th className="py-3.5 px-6">Kategori</th>
                  <th className="py-3.5 px-6">Nominal</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-center">Bukti</th>
                  <th className="py-3.5 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 text-sm text-slate-600 font-medium whitespace-nowrap">
                      {trx.trx_date || "-"}
                    </td>

                    <td className="py-4 px-6">
                      {editingId === trx.id ? (
                        <div className="space-y-2 min-w-[220px] max-w-sm py-1">
                          <div>
                            <label className="block text-2xs font-semibold text-slate-500 mb-0.5">
                              Nama Pihak / Toko
                            </label>
                            <input
                              type="text"
                              autoFocus
                              value={editForm.party}
                              onChange={(e) => setEditForm({ ...editForm, party: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit(trx.id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              placeholder="Nama Pihak / Toko..."
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white shadow-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-2xs font-semibold text-slate-500 mb-0.5">
                              Keterangan (opsional)
                            </label>
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit(trx.id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              placeholder="Keterangan..."
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 outline-none bg-white"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => handleSaveEdit(trx.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                            >
                              {savingEdit ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              <span>Simpan</span>
                            </button>
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Batal</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="group/cell flex items-center justify-between gap-3 min-w-[200px]">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div
                              className={`p-1.5 rounded-lg shrink-0 ${
                                trx.type === "income"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-rose-50 text-rose-600"
                              }`}
                            >
                              {trx.type === "income" ? (
                                <ArrowUpCircle className="w-4 h-4" />
                              ) : (
                                <ArrowDownCircle className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(trx);
                                }}
                                title="Klik untuk ubah nama pihak"
                                className="font-semibold text-slate-900 text-sm truncate cursor-pointer hover:text-emerald-700 transition"
                              >
                                {trx.party || "Tanpa Nama"}
                              </p>
                              <p
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(trx);
                                }}
                                title="Klik untuk ubah keterangan"
                                className="text-xs text-slate-400 line-clamp-1 cursor-pointer hover:text-slate-600 transition"
                              >
                                {trx.description || (
                                  <span className="italic text-slate-300">Tambah keterangan...</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(trx);
                            }}
                            title="Ubah Pihak / Keterangan"
                            className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {trx.category_name || "Lainnya"}
                      </span>
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap">
                      <p
                        className={`font-bold text-sm ${
                          trx.type === "income" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {trx.type === "income" ? "+" : "-"} {formatRupiah(trx.amount, trx.currency_code)}
                      </p>
                      {trx.payment_method && (
                        <p className="text-xs text-slate-400">{trx.payment_method}</p>
                      )}
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          trx.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {trx.status}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      {trx.has_attachment ? (
                        <button
                          onClick={() => handlePreviewAttachment(trx)}
                          title="Lihat Dokumen Bukti"
                          className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 text-xs font-semibold"
                        >
                          <Paperclip className="w-4 h-4" />
                          <span>Lihat</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(trx.id)}
                        title="Hapus Transaksi"
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Preview Bukti Lampiran */}
      <Modal
        isOpen={Boolean(previewUrl)}
        onClose={() => {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }}
        title={previewTitle}
      >
        <div className="flex justify-center p-2">
          {previewMime === "application/pdf" ? (
            <iframe src={previewUrl} title="Dokumen Bukti" className="w-full h-[65vh] rounded-xl border" />
          ) : (
            <img src={previewUrl} alt="Bukti" className="max-h-[65vh] object-contain rounded-xl shadow" />
          )}
        </div>
      </Modal>
    </div>
  );
}

