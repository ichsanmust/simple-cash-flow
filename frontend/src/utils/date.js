/**
 * Utility helper untuk manipulasi dan format tanggal berbasis waktu lokal (bukan UTC).
 */

/**
 * Format Date object menjadi string "YYYY-MM-DD" sesuai waktu lokal user.
 * Menghindari bug timezone offset akibat pemanggilan toISOString().
 */
export function formatLocalDate(date = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format YYYY-MM-DD menjadi format teks Indonesia (contoh: "01 Nov 2026")
 */
export function formatReadableDate(dateStr) {
  if (!dateStr) return "-";
  const parts = String(dateStr).split("-").map(Number);
  if (parts.length < 3) return dateStr;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Dapatkan rentang tanggal ({ date_from, date_to }) awal s/d akhir untuk periode tertentu:
 * - "this_month": Tanggal 1 bulan ini s/d hari terakhir bulan ini
 * - "last_month": Tanggal 1 bulan lalu s/d hari terakhir bulan lalu
 * - "this_year": Tanggal 1 Januari tahun ini s/d 31 Desember tahun ini
 * - "all": {} (semua rentang)
 */
export function getDateRange(period) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 11 = Des)

  if (period === "this_month") {
    const start = formatLocalDate(new Date(year, month, 1));
    const end = formatLocalDate(new Date(year, month + 1, 0));
    return { date_from: start, date_to: end };
  }

  if (period === "last_month") {
    const start = formatLocalDate(new Date(year, month - 1, 1));
    const end = formatLocalDate(new Date(year, month, 0));
    return { date_from: start, date_to: end };
  }

  if (period === "this_year") {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return { date_from: start, date_to: end };
  }

  return {}; // Semua waktu
}

