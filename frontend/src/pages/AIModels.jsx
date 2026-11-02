import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  Key,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { aiModelsApi } from "../api/client";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

export default function AIModels() {
  const [models, setModels] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // API Key Form State
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  // Test Connection State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Modal Add Model
  const [modalOpen, setModalOpen] = useState(false);
  const [newModelForm, setNewModelForm] = useState({
    name: "",
    model_id: "",
    provider: "OpenRouter",
    description: "",
  });
  const [submittingModel, setSubmittingModel] = useState(false);

  const { addToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await aiModelsApi.list();
      setModels(data.models || []);
      setSettings(data.settings || null);
    } catch (err) {
      addToast(err.message || "Gagal memuat daftar model AI", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      addToast("Masukkan API Key terlebih dahulu", "error");
      return;
    }
    setSavingKey(true);
    try {
      await aiModelsApi.updateSettings({ openrouter_api_key: apiKeyInput.trim() });
      addToast("API Key OpenRouter berhasil disimpan ke database!");
      setApiKeyInput("");
      loadData();
    } catch (err) {
      addToast(err.message || "Gagal menyimpan API Key", "error");
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestConnection = async (modelId = null) => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = {};
      if (modelId) payload.model_id = modelId;
      const res = await aiModelsApi.testConnection(payload);
      setTestResult(res);
      if (res.success) {
        addToast(res.message);
      } else {
        addToast(res.message, "error");
      }
    } catch (err) {
      const res = { success: false, message: err.message || "Gagal menguji koneksi" };
      setTestResult(res);
      addToast(res.message, "error");
    } finally {
      setTesting(false);
    }
  };

  const handleActivateModel = async (model) => {
    try {
      await aiModelsApi.activate(model.id);
      addToast(`Model "${model.name}" berhasil diaktifkan!`);
      loadData();
    } catch (err) {
      addToast(err.message || "Gagal mengaktifkan model", "error");
    }
  };

  const handleDeleteModel = async (model) => {
    if (!window.confirm(`Hapus model "${model.name}"?`)) return;
    try {
      await aiModelsApi.delete(model.id);
      addToast("Model berhasil dihapus");
      loadData();
    } catch (err) {
      addToast(err.message || "Gagal menghapus model", "error");
    }
  };

  const handleCreateModel = async (e) => {
    e.preventDefault();
    if (!newModelForm.name.trim() || !newModelForm.model_id.trim()) {
      addToast("Nama dan Model ID tidak boleh kosong", "error");
      return;
    }

    setSubmittingModel(true);
    try {
      await aiModelsApi.create({
        ...newModelForm,
        provider: "OpenRouter",
      });
      addToast("Model baru berhasil ditambahkan!");
      setModalOpen(false);
      setNewModelForm({
        name: "",
        model_id: "",
        provider: "OpenRouter",
        description: "",
      });
      loadData();
    } catch (err) {
      addToast(err.message || "Gagal menambahkan model", "error");
    } finally {
      setSubmittingModel(false);
    }
  };

  const activeModel = models.find((m) => m.is_active);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-xs">
              <Cpu className="w-5 h-5 text-emerald-400" />
            </div>
            <span>Pengaturan Model AI</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola daftar model AI vision dan API key yang tersimpan aman di database untuk analisis struk otomatis
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() => handleTestConnection()}
            disabled={testing}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
            ) : (
              <Zap className="w-4 h-4 text-amber-500" />
            )}
            <span>Tes Koneksi AI</span>
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Model</span>
          </button>
        </div>
      </div>

      {/* Banner Hasil Tes Koneksi */}
      {testResult && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
            testResult.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-bold">
              {testResult.success ? "Koneksi AI Berhasil" : "Uji Koneksi AI Gagal"}
            </p>
            <p className="text-xs leading-relaxed">{testResult.message}</p>
          </div>
        </div>
      )}

      {/* Grid: Status Model Aktif & API Key Setting */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kartu Model Aktif Saat Ini */}
        <div className="lg:col-span-5 bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Model Aktif</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {activeModel?.provider || "OpenRouter"}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900">
              {activeModel?.name || "Belum Ada Model Dipilih"}
            </h3>

            <div className="mt-1.5">
              <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block break-all">
                {activeModel?.model_id || "google/gemini-2.5-flash"}
              </code>
            </div>

            <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
              {activeModel?.description || "Model ini digunakan secara otomatis saat mengekstrak struk belanja di halaman Tambah Pengeluaran."}
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Tersimpan di: Database</span>
            <span>Gateway: OpenRouter</span>
          </div>
        </div>

        {/* Kartu Pengaturan OpenRouter API Key */}
        <div className="lg:col-span-7 bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-base">OpenRouter API Key (Database)</h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  settings?.has_openrouter_api_key
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {settings?.has_openrouter_api_key ? "Tersimpan di DB" : "Belum Diisi"}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              API Key ini tersimpan langsung di tabel database <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">app_settings</code> (bukan di file .env).
            </p>

            {settings?.has_openrouter_api_key && (
              <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Key Aktif Saat Ini:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {settings.openrouter_api_key_masked}
                </span>
              </div>
            )}

            <form onSubmit={handleSaveApiKey} className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Masukkan / Ganti API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                  />
                  <button
                    type="submit"
                    disabled={savingKey || !apiKeyInput.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                  >
                    {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Key"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Dapatkan key di <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-slate-700 underline font-medium">openrouter.ai/keys</a></span>
            <span>Mendukung saldo prabayar OpenRouter</span>
          </div>
        </div>
      </div>

      {/* Section: Daftar Model Tersedia */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Daftar Pilihan Model AI</h3>
            <p className="text-xs text-slate-500">
              Pilih salah satu model di bawah untuk langsung digunakan oleh asisten ekstraksi struk
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            Total {models.length} Model Terdaftar
          </span>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((m) => {
              const isSelected = m.is_active;
              return (
                <div
                  key={m.id}
                  className={`bg-white rounded-xl p-5 border transition flex flex-col justify-between ${
                    isSelected
                      ? "border-slate-800 shadow-sm ring-1 ring-slate-800"
                      : "border-slate-200 hover:border-slate-300 shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
                        {m.provider}
                      </span>

                      {isSelected ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        m.is_custom && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Kustom
                          </span>
                        )
                      )}
                    </div>

                    <h4 className="font-semibold text-slate-900 text-sm">{m.name}</h4>

                    <div className="mt-1">
                      <code className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 break-all inline-block">
                        {m.model_id}
                      </code>
                    </div>

                    <p className="text-xs text-slate-500 mt-2.5 leading-relaxed line-clamp-3">
                      {m.description || "Model vision untuk OCR struk dan kuitansi pembayaran."}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    {m.is_custom && !isSelected && (
                      <button
                        onClick={() => handleDeleteModel(m)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Hapus Model"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {isSelected ? (
                      <span className="w-full py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg text-center cursor-default">
                        Sedang Digunakan
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivateModel(m)}
                        className="w-full py-1.5 bg-slate-50 hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-900 text-xs font-semibold rounded-lg transition shadow-sm text-center"
                      >
                        Gunakan Model Ini
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah Model Kustom */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Model AI Baru">
        <form onSubmit={handleCreateModel} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Model
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Meta Llama 3.2 Vision"
              value={newModelForm.name}
              onChange={(e) => setNewModelForm({ ...newModelForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Model ID (OpenRouter)
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: meta-llama/llama-3.2-11b-vision-instruct"
              value={newModelForm.model_id}
              onChange={(e) => setNewModelForm({ ...newModelForm, model_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Lihat format model ID di katalog model OpenRouter (contoh: provider/nama-model)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Provider
            </label>
            <input
              type="text"
              readOnly
              value="OpenRouter"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-100 text-slate-500 cursor-not-allowed select-none font-medium"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Gateway AI saat ini dikunci ke OpenRouter untuk fleksibilitas multi-model.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Keterangan kecepatan, akurasi, atau biaya model"
              value={newModelForm.description}
              onChange={(e) => setNewModelForm({ ...newModelForm, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
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
              disabled={submittingModel}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              {submittingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Simpan Model</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

