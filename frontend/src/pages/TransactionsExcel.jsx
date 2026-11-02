import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Handsontable from "handsontable";
import { registerAllModules } from "handsontable/registry";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";
import "handsontable/styles/ht-icons-main.min.css";

import { formatRupiah, transactionsApi } from "../api/client";
import { useToast } from "../components/Toast";

// Daftarkan semua modul Handsontable (Filter, Dropdown, Sorting, Export, dll)
registerAllModules();

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function TransactionsExcel() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [rawTransactions, setRawTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingState, setSavingState] = useState("idle"); // 'idle' | 'saving' | 'saved' | 'error'

  // State sel aktif & editing bar formula
  const [activeCellInfo, setActiveCellInfo] = useState({
    row: null,
    col: null,
    prop: null,
    coords: "A1",
    colName: "Pilih sel",
    value: "",
    isEditable: false,
    trxId: null,
  });
  const [formulaInputValue, setFormulaInputValue] = useState("");

  const { addToast } = useToast();
  const containerRef = useRef(null);
  const hotInstanceRef = useRef(null);
  const dataRef = useRef([]);
  const lastSavedRef = useRef({ trxId: null, prop: null, value: null, time: 0 });

  // Hitung rentang tanggal YYYY-MM-01 s/d akhir bulan
  const { dateFrom, dateTo } = useMemo(() => {
    const pad = (n) => String(n).padStart(2, "0");
    const mStr = pad(selectedMonth);
    const start = `${selectedYear}-${mStr}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const end = `${selectedYear}-${mStr}-${pad(lastDay)}`;
    return { dateFrom: start, dateTo: end };
  }, [selectedMonth, selectedYear]);

  // Load data transaksi dari backend
  const loadMonthData = async () => {
    setLoading(true);
    try {
      const list = await transactionsApi.list({
        date_from: dateFrom,
        date_to: dateTo,
      });
      setRawTransactions(list || []);
    } catch (err) {
      addToast(err.message || "Gagal memuat transaksi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [dateFrom, dateTo]);

  // Transform data untuk Handsontable rows
  const tableData = useMemo(() => {
    const rows = (rawTransactions || []).map((t) => ({
      id: t.id,
      trx_date: t.trx_date || "-",
      type: t.type,
      type_label: t.type === "income" ? "Pemasukan" : "Pengeluaran",
      party: t.party || "",
      description: t.description || "",
      category_name: t.category_name || "Lainnya",
      amount: t.amount || 0,
      amount_formatted: `${t.type === "income" ? "+" : "-"} ${formatRupiah(t.amount || 0, t.currency_code)}`,
      currency_code: t.currency_code || "IDR",
      payment_method: t.payment_method || "-",
      status: (t.status || "").toUpperCase(),
    }));
    dataRef.current = rows;
    return rows;
  }, [rawTransactions]);

  // Ringkasan Cepat Bulan Terpilih
  const monthlySummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    (rawTransactions || []).forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === "income") income += amt;
      else expense += amt;
    });
    return {
      income,
      expense,
      balance: income - expense,
      count: rawTransactions.length,
    };
  }, [rawTransactions]);

  // Navigasi Bulan
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(currentDate.getMonth() + 1);
    setSelectedYear(currentDate.getFullYear());
  };

  // Shortcut Excel: Ctrl+S / Cmd+S untuk simpan
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const hot = hotInstanceRef.current;
        if (hot) {
          const editor = hot.getActiveEditor();
          if (editor && editor.isOpened()) {
            editor.finishEditing();
          }
        }
        addToast("Semua data transaksi tersimpan di database!");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Simpan perubahan ke backend via API
  const persistCellChange = async (trxId, prop, newValue) => {
    const cleanVal = String(newValue ?? "").trim();
    if (prop === "party" && !cleanVal) {
      addToast("Nama Pihak/Vendor tidak boleh kosong", "error");
      return false;
    }

    // Cegah duplikasi panggilan simpan dan double toast (< 1.5 detik)
    const now = Date.now();
    if (
      lastSavedRef.current.trxId === trxId &&
      lastSavedRef.current.prop === prop &&
      lastSavedRef.current.value === cleanVal &&
      now - lastSavedRef.current.time < 1500
    ) {
      return true;
    }
    lastSavedRef.current = { trxId, prop, value: cleanVal, time: now };

    setSavingState("saving");
    try {
      const payload = {
        [prop]: cleanVal || (prop === "description" ? null : ""),
      };
      await transactionsApi.update(trxId, payload);
      setSavingState("saved");
      addToast(`Tersimpan: ${prop === "party" ? "Pihak" : "Keterangan"} berhasil diperbarui!`);
      setTimeout(() => setSavingState("idle"), 2500);
      return true;
    } catch (err) {
      setSavingState("error");
      addToast(err.message || "Gagal menyimpan perubahan ke database", "error");
      return false;
    }
  };

  // Inisialisasi Handsontable langsung tanpa perantara React wrapper
  useEffect(() => {
    if (!containerRef.current || loading || tableData.length === 0) return;

    // Hancurkan instance lama jika ada
    if (hotInstanceRef.current) {
      hotInstanceRef.current.destroy();
      hotInstanceRef.current = null;
    }

    const columns = [
      {
        data: "id",
        readOnly: true,
        width: 65,
        className: "htCenter htMiddle text-slate-400 font-mono text-xs select-none",
      },
      {
        data: "trx_date",
        readOnly: true,
        width: 110,
        className: "htCenter htMiddle font-medium text-xs text-slate-700",
      },
      {
        data: "type_label",
        readOnly: true,
        width: 125,
        className: "htCenter htMiddle text-xs font-bold",
      },
      {
        data: "party",
        type: "text",
        editor: "text",
        readOnly: false, // BISA DIEDIT LANGSUNG
        width: 250,
        className: "htLeft htMiddle text-xs font-semibold text-slate-900 bg-emerald-50/20",
      },
      {
        data: "description",
        type: "text",
        editor: "text",
        readOnly: false, // BISA DIEDIT LANGSUNG
        width: 280,
        className: "htLeft htMiddle text-xs text-slate-700 bg-emerald-50/20",
      },
      {
        data: "category_name",
        readOnly: true,
        width: 135,
        className: "htCenter htMiddle text-xs text-slate-700 font-medium",
      },
      {
        data: "amount_formatted",
        readOnly: true,
        width: 145,
        className: "htRight htMiddle text-xs font-bold font-mono",
      },
      {
        data: "currency_code",
        readOnly: true,
        width: 75,
        className: "htCenter htMiddle text-xs font-mono text-slate-500",
      },
      {
        data: "payment_method",
        readOnly: true,
        width: 135,
        className: "htCenter htMiddle text-xs text-slate-600",
      },
      {
        data: "status",
        readOnly: true,
        width: 105,
        className: "htCenter htMiddle text-2xs font-extrabold uppercase tracking-wider",
      },
    ];

    const colHeaders = [
      "ID",
      "Tanggal",
      "Tipe",
      "Pihak (Vendor / Sumber) ✏️",
      "Keterangan ✏️",
      "Kategori",
      "Nominal (Rp)",
      "Valuta",
      "Metode Bayar",
      "Status",
    ];

    const hot = new Handsontable(containerRef.current, {
      data: tableData,
      columns,
      colHeaders,
      rowHeaders: true,
      height: 620,
      width: "100%",
      stretchH: "all",
      autoWrapRow: true,
      autoWrapCol: true,
      dropdownMenu: true,
      filters: true,
      columnSorting: true,
      manualColumnResize: true,
      manualRowResize: true,
      licenseKey: "non-commercial-and-evaluation",
      className: "ht-theme-main",

      // Hak akses sel: hanya 'party' dan 'description' yang editable
      cells: function (row, col, prop) {
        const cellProperties = {};
        if (prop === "party" || prop === "description") {
          cellProperties.readOnly = false;
          cellProperties.editor = "text";
        } else {
          cellProperties.readOnly = true;
          cellProperties.editor = false;
        }
        return cellProperties;
      },

      // Update inspector sel aktif
      afterSelection: function (row, col) {
        if (row < 0 || col < 0) return;
        try {
          const colLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
          const propNames = [
            "id",
            "trx_date",
            "type_label",
            "party",
            "description",
            "category_name",
            "amount_formatted",
            "currency_code",
            "payment_method",
            "status",
          ];
          const colName = colHeaders[col] || `Kolom ${col + 1}`;
          const coord = `${colLetters[col] || "A"}${row + 1}`;
          const prop = propNames[col] || "";
          const val = hot.getDataAtCell(row, col);
          const isEditable = col === 3 || col === 4;

          const physicalRow = hot.toPhysicalRow(row);
          const rowData = dataRef.current[physicalRow] || hot.getSourceDataAtRow(physicalRow);

          setActiveCellInfo({
            row,
            col,
            prop,
            coords: coord,
            colName,
            value: val === null || val === undefined ? "" : String(val),
            isEditable,
            trxId: rowData?.id || null,
          });
          setFormulaInputValue(val === null || val === undefined ? "" : String(val));
        } catch {
          // Abaikan error koordinat transien
        }
      },

      // Handler auto-save setelah selesai edit sel di spreadsheet
      afterChange: async function (changes, source) {
        if (!changes || source === "loadData" || source === "revert" || source === "formulaBar") return;

        for (const [row, prop, oldValue, newValue] of changes) {
          if (oldValue === newValue) continue;

          const physicalRow = hot.toPhysicalRow(row);
          const rowData = dataRef.current[physicalRow] || hot.getSourceDataAtRow(physicalRow);
          if (!rowData || !rowData.id) continue;

          const success = await persistCellChange(rowData.id, prop, newValue);
          if (!success) {
            // Kembalikan ke nilai sebelumnya jika gagal
            hot.setDataAtRowProp(row, prop, oldValue, "revert");
          } else {
            if (dataRef.current[physicalRow]) {
              dataRef.current[physicalRow][prop] = newValue;
            }
          }
        }
      },
    });

    hotInstanceRef.current = hot;

    return () => {
      if (hotInstanceRef.current) {
        hotInstanceRef.current.destroy();
        hotInstanceRef.current = null;
      }
    };
  }, [tableData, loading]);

  // Handler simpan dari Formula Bar di atas
  const handleSaveFromFormulaBar = async (e) => {
    e.preventDefault();
    if (!activeCellInfo.isEditable || !activeCellInfo.trxId || !hotInstanceRef.current) return;

    const hot = hotInstanceRef.current;
    const { row, prop, trxId } = activeCellInfo;

    const currentVal = hot.getDataAtRowProp(row, prop);
    if (String(currentVal ?? "").trim() === String(formulaInputValue ?? "").trim()) {
      return;
    }

    const success = await persistCellChange(trxId, prop, formulaInputValue);
    if (success) {
      hot.setDataAtRowProp(row, prop, formulaInputValue, "formulaBar");
      const physicalRow = hot.toPhysicalRow(row);
      if (dataRef.current[physicalRow]) {
        dataRef.current[physicalRow][prop] = formulaInputValue;
      }
      setActiveCellInfo((prev) => ({ ...prev, value: formulaInputValue }));
    }
  };

  // Ekspor ke CSV
  const handleExportCSV = () => {
    const hot = hotInstanceRef.current;
    if (!hot) return;
    const exportPlugin = hot.getPlugin("exportFile");
    if (!exportPlugin) {
      addToast("Plugin ekspor tidak aktif", "error");
      return;
    }
    const monthName = MONTH_NAMES[selectedMonth - 1];
    exportPlugin.downloadFile("csv", {
      bom: true,
      columnHeaders: true,
      exportHiddenColumns: true,
      exportHiddenRows: true,
      fileExtension: "csv",
      filename: `SimpleCashflow_Transaksi_${monthName}_${selectedYear}`,
      mimeType: "text/csv",
      rowHeaders: true,
    });
    addToast("File CSV berhasil diekspor!");
  };

  // Opsi tahun
  const yearOptions = [
    currentDate.getFullYear() - 2,
    currentDate.getFullYear() - 1,
    currentDate.getFullYear(),
    currentDate.getFullYear() + 1,
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Utama & Pemilih Bulan/Tahun */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white/90 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Transaksi <span className="text-emerald-600 font-extrabold">(Excel View)</span>
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Spreadsheet Handsontable tanpa paginasi dengan filter kolom & inline editing kolom Pihak & Keterangan
          </p>
        </div>

        {/* Controls Bar: Bulan, Tahun, Navigasi & Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navigasi Bulan Cepat */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
            <button
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Select Bulan */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 px-2 py-1 outline-none cursor-pointer"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>

            {/* Select Tahun */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 px-2 py-1 outline-none cursor-pointer border-l border-slate-200"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tombol Bulan Ini */}
          <button
            onClick={handleCurrentMonth}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Bulan Ini
          </button>

          {/* Tombol Reload Data */}
          <button
            onClick={loadMonthData}
            title="Muat Ulang Data"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Tombol Ekspor CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Excel Stats Strip (Ringkasan Cepat) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200/80 p-3 flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Total Pemasukan</p>
            <p className="text-base font-bold text-emerald-600 mt-0.5">
              +{formatRupiah(monthlySummary.income)}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200/80 p-3 flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Total Pengeluaran</p>
            <p className="text-base font-bold text-rose-600 mt-0.5">
              -{formatRupiah(monthlySummary.expense)}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200/80 p-3 flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Bersih</p>
            <p
              className={`text-base font-bold mt-0.5 ${
                monthlySummary.balance >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {monthlySummary.balance >= 0 ? "+" : ""}
              {formatRupiah(monthlySummary.balance)}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200/80 p-3 flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah Baris Data</p>
            <p className="text-base font-bold text-slate-900 mt-0.5">
              {monthlySummary.count} <span className="text-xs font-normal text-slate-400">transaksi</span>
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Excel Formula Bar / Active Cell Inspector & Quick Edit Bar */}
      <div className="bg-white/95 rounded-xl border border-slate-200/90 shadow-xs px-3.5 py-2 flex items-center gap-3 text-xs">
        {/* Cell Coordinate Box */}
        <div className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md font-mono font-bold text-slate-800 text-2xs min-w-[36px] text-center shrink-0">
          {activeCellInfo.coords}
        </div>

        {/* fx symbol */}
        <div className="font-serif italic font-bold text-slate-400 select-none shrink-0">fx</div>

        {/* Formula Bar Interactive Input when editable, or Text display */}
        {activeCellInfo.isEditable ? (
          <form onSubmit={handleSaveFromFormulaBar} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={formulaInputValue}
              onChange={(e) => setFormulaInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveFromFormulaBar(e);
                }
              }}
              placeholder={`Ketik untuk mengubah ${activeCellInfo.colName}... (Tekan Enter untuk simpan)`}
              className="flex-1 px-2.5 py-1 text-xs font-semibold text-slate-900 bg-slate-50 border border-emerald-400 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <span
              title="Tekan tombol Enter pada keyboard untuk menyimpan"
              className="px-2.5 py-1 bg-slate-100 text-slate-400 border border-slate-200/80 rounded-lg text-2xs font-medium select-none shrink-0 cursor-default"
            >
              Tekan Enter ↵
            </span>
          </form>
        ) : (
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <span className="font-medium text-slate-700 truncate max-w-lg">
              {activeCellInfo.value || <span className="text-slate-400 italic">(sel kosong)</span>}
            </span>
            <span className="text-2xs text-slate-400">({activeCellInfo.colName})</span>
          </div>
        )}

        {/* Editability Indicator & Auto-Save Status */}
        <div className="flex items-center gap-2 shrink-0">
          {activeCellInfo.isEditable ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-2xs font-semibold">
              <Pencil className="w-3 h-3 text-emerald-600" />
              <span>Dapat Diedit</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md text-2xs font-medium">
              <Lock className="w-3 h-3" />
              <span>Read Only</span>
            </span>
          )}

          {/* Auto-Save Indicator Status */}
          <div className="border-l border-slate-200 pl-2">
            {savingState === "saving" && (
              <span className="inline-flex items-center gap-1 text-2xs text-amber-600 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Menyimpan...</span>
              </span>
            )}
            {savingState === "saved" && (
              <span className="inline-flex items-center gap-1 text-2xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Tersimpan</span>
              </span>
            )}
            {savingState === "error" && (
              <span className="inline-flex items-center gap-1 text-2xs text-rose-600 font-medium">
                <span>Gagal Simpan!</span>
              </span>
            )}
            {savingState === "idle" && (
              <span className="inline-flex items-center gap-1 text-2xs text-slate-400">
                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                <span>Siap</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Spreadsheet Container (Direct Handsontable) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-1 relative">
        {loading ? (
          <div className="py-28 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-slate-900 mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Memuat data spreadsheet {MONTH_NAMES[selectedMonth - 1]} {selectedYear}...
            </p>
          </div>
        ) : tableData.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
              <FileSpreadsheet className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Tidak ada transaksi pada {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan pemilih bulan di atas untuk beralih ke periode lain atau tambahkan transaksi baru
            </p>
            <div className="flex items-center gap-2 mt-4">
              <Link
                to="/expenses/add"
                className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
              >
                + Tambah Pengeluaran
              </Link>
              <Link
                to="/incomes/add"
                className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
              >
                + Tambah Pemasukan
              </Link>
            </div>
          </div>
        ) : (
          <div className="excel-handsontable-wrapper" style={{ minHeight: "560px" }}>
            <div ref={containerRef} className="ht-theme-main" />
          </div>
        )}
      </div>

      {/* Spreadsheet Instructions / Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-white/70 px-4 py-2.5 rounded-xl border border-slate-200/60">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            Kolom <strong className="text-slate-800">Pihak</strong> & <strong className="text-slate-800">Keterangan</strong> dapat diedit (Dobel klik atau tekan Enter untuk mengedit)
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <Lock className="w-3 h-3" />
            Kolom lain dilindungi (Read-Only)
          </span>
        </div>

        <div className="flex items-center gap-3 text-2xs text-slate-400">
          <span>Simpan ala Excel: Tekan <strong>Enter</strong>, <strong>Tab</strong>, klik sel lain, atau <strong>Ctrl+S</strong></span>
          <span>&bull;</span>
          <span>Batal: Tekan <strong>Esc</strong></span>
          <span>&bull;</span>
          <span>Tanpa Paginasi (Scroll Bebas)</span>
        </div>
      </div>
    </div>
  );
}
