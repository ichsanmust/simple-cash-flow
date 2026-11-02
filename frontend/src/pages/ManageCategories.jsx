import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  CheckCircle2,
  Edit2,
  FolderPlus,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { categoriesApi } from "../api/client";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

export default function ManageCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'expense' | 'income'
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("expense");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const isFirstTime = new URLSearchParams(location.search).get("first_time") === "true";

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.list(null, true);
      setCategories(data);
    } catch (err) {
      addToast(err.message || "Gagal memuat kategori", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const data = await categoriesApi.seedDefaults();
      setCategories(data);
      addToast("Berhasil menambahkan kategori standar otomatis!");
      if (isFirstTime) {
        // Hapus query first_time dari URL secara halus
        navigate("/categories", { replace: true });
      }
    } catch (err) {
      addToast(err.message || "Gagal membuat kategori standar", "error");
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenCreateModal = (type = "expense") => {
    setEditingCategory(null);
    setFormName("");
    setFormType(type === "all" ? "expense" : type);
    setFormIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEditModal = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.type);
    setFormIsActive(cat.is_active);
    setModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      addToast("Nama kategori tidak boleh kosong", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, {
          name: cleanName,
          is_active: formIsActive,
        });
        addToast(`Kategori '${cleanName}' berhasil diperbarui!`);
      } else {
        await categoriesApi.create({
          name: cleanName,
          type: formType,
        });
        addToast(`Kategori '${cleanName}' berhasil ditambahkan!`);
      }
      setModalOpen(false);
      loadCategories();
    } catch (err) {
      addToast(err.message || "Gagal menyimpan kategori", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (cat) => {
    try {
      await categoriesApi.update(cat.id, { is_active: !cat.is_active });
      addToast(`Status kategori '${cat.name}' diubah menjadi ${!cat.is_active ? "Aktif" : "Nonaktif"}`);
      setCategories((prev) =>
        prev.map((item) => (item.id === cat.id ? { ...item, is_active: !cat.is_active } : item))
      );
    } catch (err) {
      addToast(err.message || "Gagal memperbarui status kategori", "error");
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Yakin ingin menghapus kategori '${cat.name}'?`)) return;

    try {
      await categoriesApi.delete(cat.id);
      addToast(`Kategori '${cat.name}' berhasil dihapus`);
      setCategories((prev) => prev.filter((item) => item.id !== cat.id));
    } catch (err) {
      addToast(err.message || "Gagal menghapus kategori", "error");
    }
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (activeTab !== "all" && cat.type !== activeTab) return false;
      if (!showInactive && !cat.is_active) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!cat.name.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [categories, activeTab, showInactive, searchQuery]);

  const expenseCount = categories.filter((c) => c.type === "expense").length;
  const incomeCount = categories.filter((c) => c.type === "income").length;
  const hasNoCategories = !loading && categories.length === 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Tags className="w-6 h-6 text-slate-800" />
            <span>Kelola Kategori</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Atur dan kelompokkan kategori pemasukan & pengeluaran untuk akun Anda
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={seeding || loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80 transition shadow-xs disabled:opacity-50"
            title="Muat atau lengkapi kategori standar otomatis"
          >
            {seeding ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <Sparkles className="w-4 h-4 text-emerald-600" />
            )}
            <span>Isi Kategori Standar</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreateModal(activeTab)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori</span>
          </button>
        </div>
      </div>

      {/* Onboarding Banner jika user belum punya kategori atau query first_time=true */}
      {(hasNoCategories || isFirstTime) && (
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300/50">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Setup Kategori Akun Baru
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Selamat Datang di Simple Cashflow!
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Anda belum memiliki kategori transaksi. Untuk dapat mencatat pemasukan dan pengeluaran secara terorganisir, silakan buat kumpulan kategori standar otomatis (makanan, transportasi, belanja, gaji, dll) dengan satu klik tombol di bawah, atau buat kategori Anda sendiri.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {seeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>⚡ Buat Kategori Standar Otomatis</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenCreateModal("expense")}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Manual</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Total Kategori</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{categories.length}</p>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold text-rose-600 uppercase tracking-wider">Pengeluaran (Expense)</p>
            <p className="text-xl font-bold text-rose-700 mt-1">{expenseCount}</p>
          </div>
          <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
            <ArrowDownCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold text-emerald-600 uppercase tracking-wider">Pemasukan (Income)</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{incomeCount}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Table & Filter Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Controls: Tabs, Search & Inactive Filter */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("expense")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "expense"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ArrowDownCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Pengeluaran ({expenseCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("income")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "income"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pemasukan ({incomeCount})</span>
            </button>
          </div>

          {/* Search & Toggle Inactive */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kategori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
              />
              <span>Tampilkan Nonaktif</span>
            </label>
          </div>
        </div>

        {/* Categories Table */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin mb-2" />
            <p className="text-xs font-medium">Memuat kategori...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Tag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Tidak ada kategori ditemukan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `Tidak ada kategori yang cocok dengan pencarian "${searchQuery}".`
                : "Belum ada kategori pada filter ini. Buat kategori baru atau klik 'Isi Kategori Standar'."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                ⚡ Buat Kategori Standar
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateModal(activeTab)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition"
              >
                + Tambah Kategori
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Nama Kategori</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((cat, index) => {
                  const isExpense = cat.type === "expense";
                  return (
                    <tr
                      key={cat.id}
                      className={`hover:bg-slate-50/60 transition ${
                        !cat.is_active ? "opacity-60 bg-slate-50/30" : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono text-slate-400 text-2xs">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900 capitalize flex items-center gap-2">
                        <Tag className={`w-3.5 h-3.5 ${isExpense ? "text-rose-500" : "text-emerald-500"}`} />
                        <span>{cat.name}</span>
                      </td>

                      <td className="py-3 px-4">
                        {isExpense ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-2xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                            <ArrowDownCircle className="w-3 h-3 text-rose-500" />
                            Pengeluaran
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <ArrowUpCircle className="w-3 h-3 text-emerald-500" />
                            Pemasukan
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {cat.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-500">
                            Nonaktif
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(cat)}
                            title={cat.is_active ? "Nonaktifkan kategori" : "Aktifkan kembali kategori"}
                            className={`px-2 py-1 rounded-lg text-2xs font-semibold border transition ${
                              cat.is_active
                                ? "border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {cat.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cat)}
                            title="Ubah nama kategori"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            title="Hapus kategori"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Kategori */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? "Ubah Kategori" : "Tambah Kategori Baru"}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Kategori <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Contoh: Belanja Bulanan, Transport, Freelance"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipe Kategori <span className="text-rose-500">*</span>
            </label>
            {editingCategory ? (
              <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 capitalize">
                {editingCategory.type === "expense" ? "Pengeluaran (Expense)" : "Pemasukan (Income)"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType("expense")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    formType === "expense"
                      ? "border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4 text-rose-600" />
                  <span>Pengeluaran</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormType("income")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    formType === "income"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                  <span>Pemasukan</span>
                </button>
              </div>
            )}
          </div>

          {editingCategory && (
            <div className="pt-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                />
                <span>Kategori Aktif</span>
              </label>
              <p className="text-2xs text-slate-500 mt-1">
                Kategori nonaktif tidak akan muncul di opsi pilihan formulir transaksi baru.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{editingCategory ? "Simpan Perubahan" : "Tambah Kategori"}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

