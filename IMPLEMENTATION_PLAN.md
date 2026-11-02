# Implementation Plan: Simple Cashflow (Multi-user)

## Tujuan
- **Pengeluaran**: upload foto/invoice → diekstrak AI → user review → simpan.
- **Pemasukan**: form manual biasa (tanpa AI, data sensitif tidak dikirim ke pihak ketiga). Boleh melampirkan 1 file bukti (bukti transfer, invoice, slip gaji) yang hanya disimpan lokal.
- **Multi-user**: tiap user punya akun sendiri dan hanya bisa melihat datanya sendiri.
- **Tanpa registrasi publik**: akun hanya dibuat oleh **admin** lewat halaman **Manage User**. Login memakai **User ID + password**.
- **Mata uang**: ada tabel `currencies`; untuk saat ini hanya **IDR** yang aktif (default semua transaksi). Mata uang lain bisa ditambah admin tanpa ubah kode.
- **Monorepo dengan 2 folder**: `backend/` (Python) dan `frontend/` (web), bisa dijalankan sekaligus dengan satu perintah.

## Tech Stack
| Komponen | Pilihan | Alasan |
|---|---|---|
| Backend | FastAPI (Python 3.11+) | Simpel, async, auto docs (`/docs`) |
| DB | **MySQL 8.0+** + SQLAlchemy 2 (driver `PyMySQL`) + Alembic | Pilihan user; mendukung `CHECK` & tipe `JSON` |
| Validasi | Pydantic v2 | Bawaan FastAPI |
| Auth | User ID + password, **JWT** (`PyJWT`), hash password **argon2** (`argon2-cffi`), role `admin` / `user` | Multi-user, stateless, akun dikelola admin |
| AI (OCR+ekstraksi) | **OpenRouter AI** (endpoint `https://openrouter.ai/api/v1/chat/completions`, model `google/gemini-2.5-flash` / model vision lainnya, JSON output) | Fleksibel, multi-model (Gemini, Claude, GPT), timeout 30 detik |
| Storage file | Folder lokal `backend/uploads/<user_id>/` | Simpel; dipisah per user |
| Frontend | **React 18 + Vite + Tailwind CSS** + **Handsontable** | UI responsif modern & spreadsheet Excel interaktif |
| Runner | `npm run dev` di root (paket `concurrently`) | Backend + frontend jalan bersamaan |

## Struktur Proyek
```
simple-cash-flow/
├── package.json              # script root: setup, dev, dev:be, dev:fe
├── README.md
├── IMPLEMENTATION_PLAN.md
├── .gitignore
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── alembic.ini + alembic/    # migrasi skema
│   ├── uploads/                  # file bukti (per user_id), tidak di-commit
│   ├── tests/
│   └── app/
│       ├── main.py               # FastAPI app, CORS, router, seed saat startup
│       ├── config.py             # env settings
│       ├── db.py                 # engine & session
│       ├── models.py             # users, categories, currencies, transactions
│       ├── schemas.py            # Pydantic schema
│       ├── security.py           # hash password, JWT, dependency get_current_user
│       ├── seed.py               # seed kategori default, mata uang IDR, user admin awal (dari .env)
│       ├── routers/
│       │   ├── auth.py           # login, me, ganti password sendiri
│       │   ├── users.py          # manage user (khusus admin)
│       │   ├── expenses.py       # upload + CRUD pengeluaran (type=expense)
│       │   ├── incomes.py        # CRUD pemasukan via form (type=income)
│       │   ├── categories.py     # list/tambah kategori
│       │   ├── currencies.py     # list mata uang; tambah/ubah (admin)
│       │   └── reports.py        # ringkasan cashflow
│       └── services/
│           ├── ai_extractor.py   # panggil Gemini, return JSON
│           └── storage.py        # simpan/hapus/validasi file lampiran
└── frontend/
    ├── package.json
    ├── vite.config.js            # proxy /api → http://localhost:8000
    └── src/
        ├── main.jsx, App.jsx
        ├── api/client.js         # fetch wrapper + token JWT
        ├── pages/                # Login, Dashboard, Transactions, AddExpense, AddIncome, ManageUsers (admin), Currencies (admin), ChangePassword
        └── components/           # Navbar, Table, FileInput, SummaryCard, dll.
```

## Frontend: Pilihan & Rekomendasi
| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **React + Vite + Tailwind (rekomendasi)** | Paling populer, banyak referensi, dev server cepat, UI bisa rapi cepat dengan Tailwind | Perlu Node.js |
| Vue + Vite | Sintaks lebih ringan bagi pemula | Ekosistem lebih kecil dari React |
| HTMX + Jinja (dilayani FastAPI) | Tanpa Node, sangat sederhana | Tidak memenuhi kebutuhan folder `frontend/` terpisah; interaksi upload→review kurang nyaman |
| Streamlit | Cepat sekali untuk prototipe | Terbatas untuk multi-user/auth & tampilan kustom |

**Dipilih: React + Vite + Tailwind CSS + Handsontable.** Dependensi terpasang:
- `react`, `react-dom`, `react-router-dom`: Inti aplikasi SPA
- `tailwindcss`: Styling sistem utility-first
- `handsontable` (v18.1.2): Engine data grid spreadsheet untuk halaman `/transactions-excel` (inline cell editing, formula bar, keyboard navigation)
- `lucide-react`: Paket ikon modern konsisten
Tidak memakai Redux atau library state besar; cukup `useState` + Context untuk token user.

### Halaman
1. **Login** (User ID + password; tidak ada registrasi)
2. **Dashboard**: total pemasukan, pengeluaran, saldo, rincian per kategori, filter periode (bulan ini / custom).
3. **Transaksi**: tabel gabungan income + expense, filter tipe/kategori/tanggal, tombol lihat bukti & hapus, badge `draft`.
4. **Tambah Pengeluaran**: pilih foto → upload → loading AI → form hasil ekstraksi terisi otomatis (bisa diedit) → **Simpan/Confirm**.
5. **Tambah Pemasukan**: form biasa (tanggal, sumber, kategori, nominal, catatan) + lampiran opsional.
6. **Manage User** (menu hanya tampil untuk admin): tabel user, tambah user (User ID, nama, password awal, role), edit nama/role, reset password, **nonaktifkan/aktifkan** user. **Tidak ada hapus user**. Admin tidak bisa menonaktifkan dirinya sendiri.
7. **Mata Uang** (admin, sederhana): daftar mata uang, tambah/aktifkan/nonaktifkan. Awalnya hanya IDR.
8. **Ganti Password**: untuk semua user, bersifat opsional (tidak ada paksaan ganti password).

### Usulan Fitur Frontend

**Fase 1 (MVP, dikerjakan lebih dulu)**
| Area | Fitur |
|---|---|
| Auth | Login, logout, sesi habis → otomatis ke login, ganti password |
| Dashboard | Kartu total pemasukan / pengeluaran / saldo (periode terpilih); filter periode (bulan ini, bulan lalu, custom); ringkasan per kategori; 5 transaksi terakhir; banner jumlah draft yang belum dikonfirmasi |
| Tambah Pengeluaran | Pilih/drag-drop foto (atau ambil foto dari kamera di HP); preview gambar; indikator loading saat AI memproses; form hasil AI terisi otomatis dan bisa diedit; tanda field yang kosong/tidak yakin; tombol Simpan (confirm) atau Buang; peringatan jika file duplikat |
| Tambah Pemasukan | Form biasa (tanggal, sumber, kategori, nominal, catatan); lampiran opsional (bukti transfer/invoice/slip gaji) dengan preview |
| Transaksi | Tabel gabungan; filter tipe, kategori, tanggal, status; pencarian vendor/sumber; pagination; badge `draft`; lihat bukti (modal gambar/PDF); edit; hapus dengan konfirmasi |
| Draft | Daftar pengeluaran `draft` untuk direview/dikonfirmasi belakangan |
| Admin | Manage User (tambah, ubah, reset password, nonaktifkan), Mata Uang |
| Umum | Tampilan responsif (nyaman di HP untuk foto struk), notifikasi toast sukses/gagal, pesan error yang jelas, format Rupiah |

**Fase 2 (backlog, dikerjakan setelah Fase 1 selesai)**
| Fitur | Manfaat |
|---|---|
| Grafik: tren pemasukan vs pengeluaran per bulan, pie per kategori | Insight visual |
| Upload banyak struk sekaligus (batch) | Hemat waktu input |
| Ekspor CSV/Excel laporan | Untuk akuntan/arsip |
| Kelola kategori sendiri (tambah/nonaktifkan) | Fleksibel per user |
| Mode gelap | Kenyamanan |
| Anggaran bulanan per kategori + peringatan | Kontrol pengeluaran |
| Transaksi berulang (gaji/tagihan bulanan) | Kurangi input manual |
| Log aktivitas admin (siapa membuat/menonaktifkan user) | Audit |

**Keputusan**: implementasi dimulai dari **Fase 1** saja. Seluruh backend (auth, user, kategori, mata uang, transaksi, AI, laporan) dan semua halaman frontend pada tabel Fase 1 masuk cakupan. Fase 2 hanya backlog; kandidat prioritas pertama di Fase 2 adalah *grafik sederhana* dan *ekspor CSV*.

**Cakupan Fase 1 (checklist status: Selesai Diimplementasikan)**
- [x] Setup monorepo `backend/` + `frontend/`, `npm run dev` menjalankan keduanya
- [x] Backend: MySQL + Alembic, seed (admin dari database, kategori default, IDR)
- [x] Backend: login JWT, ganti password, manage user (admin, nonaktifkan saja)
- [x] Backend: kategori, mata uang, pemasukan + lampiran, pengeluaran + AI + confirm, daftar transaksi, laporan ringkasan
- [x] Frontend: Login, Dashboard, Tambah Pengeluaran, Tambah Pemasukan, Transaksi, Draft, Manage User, Mata Uang, Ganti Password
- [x] Tests backend (isolasi user, hak akses admin, extractor di-mock, kategori CRUD) dan README

**Fitur Tambahan & Penyempurnaan Terbaru (Selesai Diimplementasikan)**
- [x] **Kelola Kategori Per User (`/categories`)**:
  - Isolasi ketat: setiap user memiliki kategori sendiri (`user_id`).
  - Halaman manajemen kategori dengan filter tab (Semua, Pengeluaran, Pemasukan), pencarian, tambah, ubah nama, aktif/nonaktif, dan hapus dengan proteksi transaksi.
  - Onboarding user baru: saat login pertama atau jika memiliki 0 kategori, dialihkan otomatis ke `/categories?first_time=true`.
  - Sugesti 1-klik: tombol `⚡ Buat Kategori Standar Otomatis` (`POST /api/categories/seed-defaults`) untuk pemasukan & pengeluaran.
- [x] **Approve Semua Draft Sekaligus (`POST /api/expenses/drafts/approve-all`)**:
  - Tombol 1-klik di menu `/drafts` untuk mengonfirmasi seluruh draft struk valid secara massal.
  - Penanganan otomatis fallback tanggal, nama vendor, dan kategori fallback.
- [x] **Tampilan Transaksi Excel (`/transactions-excel`)**:
  - Menggunakan engine spreadsheet Handsontable tanpa pagination.
  - Filter per kolom, pemilih bulan & tahun di header atas.
  - Kolom Pihak (Vendor/Sumber) dan Keterangan terpisah dan dapat diedit langsung (inline editable) dengan double-click, formula bar, Enter, Tab, Blur, dan shortcut `Ctrl+S` / `Cmd+S`.
  - Kolom lainnya (Tanggal, Tipe, Kategori, Nominal, Pembayaran) terkunci *read-only*.
  - Menu Navbar Transaksi diubah menjadi dropdown: *Transaksi* & *Transaksi (Excel)*.
- [x] **Editable Kolom pada Tabel Transaksi Biasa (`/transactions`)**:
  - Kolom Pihak / Keterangan dapat diedit langsung inline tanpa membuka modal.
- [x] **AI Fallback Vendor**:
  - Jika nama toko / vendor hasil ekstraksi AI kosong, otomatis diisi `"Lainnya - Periksa lagi Nanti"`.
- [x] **UI/UX & Branding Refinement**:
  - Favicon dan Logo Navbar diubah menjadi ikon dollar hijau (`CircleDollarSign` emerald).
  - Standarisasi ukuran font di seluruh aplikasi agar rapi dan proporsional.
  - Mengganti seluruh tombol berwarna ungu menjadi tema elegan `slate-900 hover:bg-slate-800` dengan aksen emerald.
  - Merapikan badge status di form Tambah Pengeluaran menjadi modern pill dengan animasi denyut.

**Backlog Fitur Mendatang (Belum Dikerjakan)**
- [ ] Grafik tren pemasukan vs pengeluaran per bulan & pie chart interaktif
- [ ] Upload banyak struk sekaligus (batch upload)
- [ ] Ekspor file CSV/Excel dari ringkasan transaksi
- [ ] Mode gelap (Dark Mode)
- [ ] Anggaran bulanan (Budgeting) per kategori + notifikasi limit
- [ ] Transaksi berulang otomatis (Recurring Transactions)
- [ ] Log audit aktivitas administrator
- [ ] Integrasi webhook / Telegram Bot via Hermes AI Agent (Arsitektur telah didokumentasikan di bawah)

### Catatan Frontend
- Gambar bukti diambil lewat `fetch` dengan header `Authorization` lalu ditampilkan dari blob URL (tag `<img>` biasa tidak bisa mengirim header JWT).
- Token JWT disimpan di `localStorage` untuk MVP (sederhana; kelemahan: rentan XSS). Bisa ditingkatkan ke httpOnly cookie nanti.
- Format nominal dengan `Intl.NumberFormat('id-ID', {style:'currency', currency: kodeMataUang})`, memakai `decimal_places` dari tabel `currencies` untuk konversi satuan terkecil. Form hanya menampilkan dropdown mata uang jika ada lebih dari 1 yang aktif (saat ini disembunyikan, default IDR).
- Dev server memakai **proxy Vite**: frontend memanggil `/api/...`, diteruskan ke backend `:8000`, jadi tidak ada masalah CORS saat development.

## Cara Menjalankan (satu perintah)
Script di `package.json` root:
```json
{
  "scripts": {
    "setup": "npm run setup:be && npm run setup:fe",
    "setup:be": "cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt",
    "setup:fe": "npm --prefix frontend install",
    "dev": "concurrently -n BE,FE -c blue,green \"npm:dev:be\" \"npm:dev:fe\"",
    "dev:be": "cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000",
    "dev:fe": "npm --prefix frontend run dev"
  },
  "devDependencies": { "concurrently": "^9.0.0" }
}
```
Alur pertama kali:
```
cp backend/.env.example backend/.env        # isi DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, GEMINI_API_KEY
npm install && npm run setup
cd backend && .venv/bin/alembic upgrade head && cd ..
npm run dev                                  # BE :8000, FE :5173 jalan bersamaan
```
Saat startup pertama, backend otomatis membuat user admin awal dari `.env` (lihat bagian Seed Data).

- Backend: http://localhost:8000 (docs di `/docs`)
- Frontend: http://localhost:5173

Prasyarat: Python 3.11+, Node.js 20+, MySQL 8.0+ terpasang **lokal** dulu (di VPS nanti dipasang terpisah; cukup ganti `DATABASE_URL`).

## Setup OpenRouter AI
1. Buka https://openrouter.ai/keys → **Create Key**.
2. Simpan di `backend/.env` (jangan di-commit):
   ```
   OPENROUTER_API_KEY=sk-or-v1-xxxx
   OPENROUTER_MODEL=google/gemini-2.5-flash
   ```
3. Panggilan API memakai client `httpx` ke `https://openrouter.ai/api/v1/chat/completions` dengan gambar base64 (`image_url`) dan timeout 30 detik.
4. Model vision rekomendasi di OpenRouter:
   - `google/gemini-2.5-flash` (cepat & murah)
   - `google/gemini-2.0-flash-001`
   - `anthropic/claude-3.5-sonnet`
   - `openai/gpt-4o-mini`
5. Pemasukan tidak pernah dikirim ke AI. Catatan: jika OpenRouter key belum diisi, sistem menyediakan fallback ke Gemini API langsung jika `GEMINI_API_KEY` terpasang.

## Skema Database

**Database:** MySQL 8.0+ (InnoDB, `utf8mb4`, collation `utf8mb4_unicode_ci`).
- Buat database: `CREATE DATABASE cashflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
- `.env`: `DATABASE_URL=mysql+pymysql://user:password@localhost:3306/cashflow`
- Dependensi: `PyMySQL` + `cryptography`.
- Migrasi dengan **Alembic**; seed kategori default saat startup (idempoten).
- Engine memakai `pool_pre_ping=True` dan `pool_recycle=3600`.

**4 tabel**: `users`, `categories`, `currencies`, `transactions`.

### ERD
```mermaid
erDiagram
  users ||--o{ transactions : "memiliki"
  users ||--o{ categories : "membuat (opsional)"
  categories ||--o{ transactions : "dipakai"
  currencies ||--o{ transactions : "mata uang"

  users {
    int id PK
    string username UK "User ID untuk login"
    string password_hash
    string name
    string role "admin | user"
    bool is_active
    datetime created_at
  }
  categories {
    int id PK
    int user_id FK "NULL = kategori default global"
    string name
    string type "income | expense"
    bool is_active
  }
  currencies {
    string code PK "ISO 4217, mis. IDR"
    string name
    string symbol
    int decimal_places "IDR=0, USD=2"
    bool is_active
  }
  transactions {
    int id PK
    int user_id FK
    string type "income | expense"
    date trx_date
    string party "vendor / sumber dana"
    string description
    int category_id FK
    bigint amount "satuan terkecil mata uang"
    string currency_code FK "default IDR"
    string status "draft | confirmed"
    string input_method "form | ai_receipt"
    string attachment_path
    string attachment_name
    string attachment_mime
    string attachment_sha256
    string ai_status "success | failed (hanya expense)"
    json ai_raw_json "hanya expense"
    datetime created_at
    datetime updated_at
  }
```

### Tabel `users`
| Field | Tipe | Catatan |
|---|---|---|
| id | INTEGER PK | |
| username | VARCHAR(50) | **User ID untuk login** (mis. `admin`); UNIQUE, lowercase, hanya `a-z 0-9 _ . -`. Dinamai `username` agar tidak bentrok dengan FK `user_id` di tabel lain |
| password_hash | VARCHAR(255) | argon2, tidak pernah dikembalikan di API |
| name | VARCHAR(100) | nama tampilan |
| role | VARCHAR(10) | `admin` / `user` |
| is_active | BOOLEAN | default true; user nonaktif tidak bisa login (data tetap ada) |
| created_at | DATETIME | |

### Seed Data (startup, idempoten)
Seed hanya menambah data yang belum ada, tidak menimpa data yang sudah ada.

**User admin awal**: dibuat hanya jika belum ada user dengan `username` tersebut. Kredensial **dibaca dari `backend/.env`**, tidak ditulis di kode maupun dokumen:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<password kuat>
```
- Password disimpan di DB sebagai hash argon2.
- **Tidak ada paksaan ganti password** saat login pertama.
- Karena seed tidak menimpa user yang sudah ada, mengubah `ADMIN_PASSWORD` di `.env` setelah admin terbentuk tidak mengubah password di DB. Untuk mengganti, pakai Ganti Password atau reset lewat Manage User.
- `.env` masuk `.gitignore`; di VPS buat `.env` terpisah dengan password berbeda.

**Mata uang**: `IDR` (aktif). **Kategori default**: lihat di bawah.

### Tabel `currencies`
| Field | Tipe | Catatan |
|---|---|---|
| code | CHAR(3) PK | kode ISO 4217 huruf besar, mis. `IDR`, `USD` |
| name | VARCHAR(50) | mis. `Rupiah Indonesia` |
| symbol | VARCHAR(5) | mis. `Rp` |
| decimal_places | TINYINT | jumlah desimal: IDR = 0, USD = 2. Menentukan arti `amount` |
| is_active | BOOLEAN | default true; hanya yang aktif bisa dipilih untuk transaksi baru |

Seed: `IDR | Rupiah Indonesia | Rp | 0 | aktif`. Admin dapat menambah mata uang lain (mis. USD) lewat endpoint/halaman Mata Uang. Mata uang yang sudah dipakai transaksi tidak boleh dihapus, hanya dinonaktifkan.

### Tabel `categories`
| Field | Tipe | Catatan |
|---|---|---|
| id | INTEGER PK | |
| user_id | FK → users NULL | `NULL` = kategori default yang terlihat semua user; terisi = kategori milik user itu |
| name | VARCHAR(100) | |
| type | VARCHAR(10) | `income` / `expense` |
| is_active | BOOLEAN | default true |

UNIQUE (`user_id`, `type`, `name`). Catatan: di MySQL `NULL` pada UNIQUE tidak dianggap sama, jadi duplikasi kategori default dicegah di logika seed.

Kategori default (seed, `user_id = NULL`):
| Tipe | Nilai |
|---|---|
| expense | makanan, transport, utilitas, belanja, kesehatan, hiburan, pendidikan, lainnya |
| income | gaji, usaha, investasi, hadiah, lainnya |

User boleh menambah kategori sendiri. Prompt AI diberi kategori `expense` milik user + default; hasil di luar daftar dipetakan ke `lainnya`.

### Tabel `transactions`
| Field | Tipe | Catatan |
|---|---|---|
| id | INTEGER PK | |
| user_id | FK → users | NOT NULL; **semua query wajib difilter user_id** |
| type | VARCHAR(10) | `income` / `expense` |
| trx_date | DATE NULL | null hanya untuk draft AI yang gagal baca; wajib saat confirmed |
| party | VARCHAR(200) NULL | expense: vendor/toko; income: sumber dana (wajib untuk income) |
| description | TEXT NULL | ringkasan singkat (hasil akhir saja, tanpa rincian item) |
| category_id | FK → categories NULL | tipe harus sama dengan `type`, dan milik user atau default; wajib saat confirmed |
| amount | BIGINT NULL | nominal dalam **satuan terkecil** mata uang sesuai `decimal_places` (IDR: rupiah utuh, USD: sen); wajib saat confirmed |
| currency_code | CHAR(3) FK → currencies | NOT NULL, default `IDR`; harus mata uang aktif saat transaksi dibuat |
| status | VARCHAR(10) | `draft` / `confirmed`. Income via form langsung `confirmed`; expense dari AI mulai `draft` |
| input_method | VARCHAR(12) | `form` / `ai_receipt` |
| attachment_path | VARCHAR(300) NULL | `uploads/<user_id>/<uuid>.<ext>`; 1 file per transaksi. Expense: foto struk/invoice. Income: bukti transfer/invoice/slip gaji (opsional) |
| attachment_name | VARCHAR(200) NULL | nama file asli |
| attachment_mime | VARCHAR(50) NULL | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| attachment_sha256 | CHAR(64) NULL | hash file; UNIQUE (`user_id`, `attachment_sha256`) agar tidak ada duplikat per user |
| ai_status | VARCHAR(10) NULL | `success` / `failed`; null untuk income |
| ai_raw_json | JSON NULL | respons mentah AI untuk audit; null untuk income |
| created_at, updated_at | DATETIME | |

> **Tanpa konversi kurs**: tiap transaksi disimpan dengan mata uang aslinya. Laporan menjumlah **per mata uang** (tidak dicampur). Dengan hanya IDR aktif, laporan tampil seperti biasa.

### Index & Constraint
- Index: `transactions(user_id, trx_date)`, `transactions(user_id, type, status)`, `transactions(category_id)`, `transactions(currency_code)`.
- `CHECK (type IN ('income','expense'))`, `CHECK (amount IS NULL OR amount > 0)`.
- `CHECK (type = 'expense' OR (ai_raw_json IS NULL AND ai_status IS NULL))`: field AI tidak boleh terisi pada income.
- UNIQUE (`user_id`, `attachment_sha256`).
- FK `transactions.user_id` → `users.id` dengan `ON DELETE CASCADE` (user tidak dihapus lewat aplikasi; hanya dinonaktifkan).
- FK `transactions.currency_code` → `currencies.code` (`ON DELETE RESTRICT`).

### Keputusan Desain
- **Isolasi data per user**: setiap query transaksi/kategori/lampiran memakai `WHERE user_id = :current_user`. Akses data user lain mengembalikan **404** (bukan 403) agar tidak membocorkan keberadaan data. Dibuat lewat satu helper agar tidak ada query yang lupa filter.
- **Satu tabel transaksi** untuk income & expense: laporan jadi `SUM ... GROUP BY type, category_id` tanpa join.
- **Kategori**: tabel terpisah, default global + kustom per user.
- **Pemisahan data sensitif**: endpoint income tidak pernah memanggil AI; constraint DB melarang field AI pada income.
- **Hanya simpan hasil akhir**: tanpa rincian item struk.
- **Nominal BIGINT dalam satuan terkecil, bukan float**: bebas error pembulatan; `currencies.decimal_places` menentukan cara menampilkan (IDR 0 desimal, USD 2 desimal).
- **`user_id` ada di setiap transaksi**: dasar isolasi data antar user.
- **Mata uang tabel terpisah**: mudah menambah mata uang tanpa migrasi skema.
- **Draft vs confirmed**: laporan hanya menghitung `confirmed`.
- **Hard delete** di MVP (hapus baris + file lampiran).

## API Endpoints
Semua dengan prefix `/api`. Selain `login`, semua butuh header `Authorization: Bearer <JWT>`. Endpoint `/users*` hanya untuk role `admin` (selain itu **403**). Tidak ada endpoint registrasi publik dan tidak ada endpoint hapus user.

| Method | Path | Fungsi |
|---|---|---|
| POST | `/auth/login` | Login (username + password) → `access_token` JWT |
| GET | `/auth/me` | Profil user saat ini (termasuk role) |
| POST | `/auth/change-password` | Ganti password sendiri (password lama + baru) |
| GET | `/users` | **Admin**: daftar user |
| POST | `/users` | **Admin**: buat user (username, nama, password awal, role) |
| PATCH | `/users/{id}` | **Admin**: ubah nama/role, aktifkan/**nonaktifkan** user (tanpa hapus) |
| POST | `/users/{id}/reset-password` | **Admin**: set password baru untuk user |
| POST | `/expenses/upload` | Upload gambar → AI ekstrak → simpan sebagai `draft` |
| PATCH | `/expenses/{id}` | Koreksi hasil AI |
| POST | `/expenses/{id}/confirm` | Ubah status ke `confirmed` |
| GET/DELETE | `/expenses`, `/expenses/{id}` | List (filter tanggal/kategori/status) & hapus |
| POST | `/incomes` | Input pemasukan via form (`multipart/form-data`, lampiran opsional) |
| GET/PATCH/DELETE | `/incomes[/{id}]` | CRUD |
| GET | `/transactions` | Daftar gabungan income+expense (untuk halaman Transaksi) |
| GET | `/transactions/{id}/attachment` | Lihat/unduh file bukti (pemilik saja) |
| GET/POST | `/categories?type=` | Daftar (default + milik user) / tambah kategori |
| GET | `/currencies` | Daftar mata uang aktif |
| POST/PATCH | `/currencies`, `/currencies/{code}` | **Admin**: tambah / ubah / nonaktifkan mata uang |
| GET | `/reports/summary?from=&to=` | Total masuk, keluar, saldo, per kategori; dikelompokkan per mata uang |

## Alur Pengeluaran
```mermaid
flowchart LR
  A[Upload image di FE] --> B[Validasi tipe & ukuran]
  B --> C[Simpan ke uploads/user_id/]
  C --> D[Gemini: ekstrak JSON]
  D --> E[Simpan status=draft]
  E --> F[FE tampilkan form terisi, user review/edit]
  F --> G[Confirm → confirmed]
```
Output JSON AI: `{date, vendor, total, currency, category, description}`. `currency` dibatasi ke mata uang aktif; jika tidak terbaca atau tidak aktif, dipakai `IDR`. `total` dikonversi ke satuan terkecil sesuai `decimal_places`. Jika AI gagal/ragu, tetap simpan draft dengan field kosong agar bisa diisi manual.

## Keamanan
- Password di-hash argon2; JWT bertanda tangan `JWT_SECRET` (di `.env`), masa berlaku mis. 24 jam; rate limit sederhana pada login. Pesan error login sama untuk user tidak ada / password salah.
- Tidak ada registrasi publik; akun dibuat admin. Role dicek di server (bukan hanya menyembunyikan menu di frontend).
- Password admin awal berasal dari `.env` (kuat, acak), tidak di-hardcode dan tidak masuk repo. Password minimal 8 karakter; user nonaktif ditolak saat login dan token lama tidak berlaku (cek `is_active` di setiap request).
- Admin tidak bisa menonaktifkan/menurunkan role dirinya sendiri (mencegah terkunci tanpa admin). User tidak pernah dihapus, hanya dinonaktifkan.
- Di VPS: pakai HTTPS (reverse proxy Nginx/Caddy) agar password & JWT tidak lewat HTTP polos.
- Validasi file (expense & income): JPG/PNG/WEBP/PDF, maks ~5MB, cek MIME & ekstensi, nama file di-rename UUID.
- Lampiran hanya disajikan lewat endpoint ber-auth dengan cek kepemilikan, bukan static folder publik.
- Hanya gambar pengeluaran yang dikirim ke AI; data & lampiran pemasukan tidak pernah.
- Batas penggunaan AI per user.
- User MySQL khusus aplikasi (hak minimum, bukan root); semua kredensial hanya di `.env`.
- CORS dibatasi ke origin frontend (`http://localhost:5173`) bila tidak lewat proxy.

## Detail Rencana Eksekusi Fase 1 (Step-by-Step)

Berikut adalah panduan eksekusi teknis file-per-file untuk mengimplementasikan Fase 1 secara menyeluruh.

---

### Langkah 1: Root & Orkestrasi Monorepo
1. **`package.json` (Root)**:
   - Script:
     - `setup`: jalankan `npm run setup:be && npm run setup:fe`
     - `setup:be`: buat virtualenv `.venv` di `backend/` dan pasang `requirements.txt`
     - `setup:fe`: `npm --prefix frontend install`
     - `dev`: jalankan bersamaan `dev:be` dan `dev:fe` menggunakan `concurrently`
     - `dev:be`: `.venv/bin/uvicorn app.main:app --reload --port 8000 --app-dir backend`
     - `dev:fe`: `npm --prefix frontend run dev`
   - DevDependencies: `concurrently`
2. **`.gitignore`**:
   - Abaikan `.env`, `.venv/`, `node_modules/`, `dist/`, `backend/uploads/*`, `.pytest_cache/`, `__pycache__/`, `*.db`.

---

### Langkah 2: Backend Foundation & Konfigurasi
1. **`backend/requirements.txt`**:
   - `fastapi>=0.110.0`
   - `uvicorn[standard]>=0.29.0`
   - `sqlalchemy>=2.0.28`
   - `pymysql>=1.1.0`
   - `cryptography>=42.0.5`
   - `alembic>=1.13.1`
   - `pydantic>=2.6.4`
   - `pydantic-settings>=2.2.1`
   - `python-multipart>=0.0.9`
   - `pyjwt>=2.8.0`
   - `argon2-cffi>=23.1.0`
   - `google-genai>=0.3.0`
   - `pytest>=8.1.0`
   - `httpx>=0.27.0`
2. **`backend/app/config.py`**:
   - Class `Settings(BaseSettings)`:
     - `database_url`: string koneksi MySQL
     - `jwt_secret`: kunci enkripsi token JWT
     - `jwt_algorithm`: `"HS256"`
     - `jwt_expire_hours`: `24`
     - `admin_username`: `"admin"`
     - `admin_password`: default password admin
     - `gemini_api_key`: string
     - `gemini_model`: `"gemini-2.5-flash"`
     - `ai_daily_limit_per_user`: `20`
     - `upload_dir`: `"uploads"`
     - `max_upload_mb`: `5`
3. **`backend/app/db.py`**:
   - Inisialisasi engine SQLAlchemy dengan parameter `pool_pre_ping=True`, `pool_recycle=3600`.
   - `SessionLocal = sessionmaker(...)`
   - `Base = declarative_base()`
   - Dependency `get_db()` dengan `yield` dan `finally: db.close()`.

---

### Langkah 3: Database Models & Migrasi
1. **`backend/app/models.py`**:
   - **`User`** (`users`):
     - `id`: PK Integer
     - `username`: String(50), Unique, Indexed
     - `password_hash`: String(255)
     - `name`: String(100)
     - `role`: String(10) (`"admin"` / `"user"`)
     - `is_active`: Boolean (default True)
     - `created_at`: DateTime (server_default=now())
   - **`Currency`** (`currencies`):
     - `code`: String(3), PK (ISO: IDR, USD)
     - `name`: String(50)
     - `symbol`: String(5)
     - `decimal_places`: Integer (0 untuk IDR, 2 untuk USD)
     - `is_active`: Boolean (default True)
   - **`Category`** (`categories`):
     - `id`: PK Integer
     - `user_id`: FK `users.id`, Nullable (NULL = default global)
     - `name`: String(100)
     - `type`: String(10) (`"income"` / `"expense"`)
     - `is_active`: Boolean (default True)
     - UniqueConstraint(`user_id`, `type`, `name`)
   - **`Transaction`** (`transactions`):
     - `id`: PK Integer
     - `user_id`: FK `users.id`, Not Null, Indexed
     - `type`: String(10) (`"income"` / `"expense"`)
     - `trx_date`: Date, Nullable (hanya saat draft)
     - `party`: String(200), Nullable
     - `description`: Text, Nullable
     - `category_id`: FK `categories.id`, Nullable
     - `amount`: BigInteger, Nullable (dalam satuan terkecil)
     - `currency_code`: FK `currencies.code`, default `"IDR"`
     - `payment_method`: String(30), Nullable
     - `status`: String(10) (`"draft"` / `"confirmed"`)
     - `input_method`: String(12) (`"form"` / `"ai_receipt"`)
     - `attachment_path`: String(300), Nullable
     - `attachment_name`: String(200), Nullable
     - `attachment_mime`: String(50), Nullable
     - `attachment_sha256`: String(64), Nullable
     - `ai_status`: String(10), Nullable (`"success"` / `"failed"`)
     - `ai_raw_json`: JSON, Nullable
     - `created_at`, `updated_at`: DateTime
2. **`backend/alembic/`**:
   - Inisialisasi Alembic untuk migrasi skema tabel secara resmi di MySQL.
3. **`backend/app/seed.py`**:
   - Fungsi `seed_all(db)` dijalankan saat startup aplikasi:
     - Cek apakah user admin (`config.admin_username`) sudah ada; jika belum, buat dengan password dari `config.admin_password` (hash argon2).
     - Cek mata uang `IDR`; jika belum ada, masukkan (`Rupiah Indonesia`, `Rp`, `0`, `True`).
     - Cek kategori default global (`user_id=None`); masukkan daftar default pengeluaran & pemasukan.

---

### Langkah 4: Keamanan & Autentikasi
1. **`backend/app/security.py`**:
   - Password hashing & verification menggunakan `argon2.PasswordHasher`.
   - JWT generator: `create_access_token(data: dict, expires_delta: timedelta)`.
   - Dependency `get_current_user(token, db)`: verifikasi token JWT, ambil user dari DB, pastikan `is_active == True`.
   - Dependency `require_admin(current_user)`: pastikan `current_user.role == "admin"`, lempar 403 Forbidden jika bukan.

---

### Langkah 5: Pydantic Schemas (`backend/app/schemas.py`)
1. **Auth & User**:
   - `LoginRequest`, `TokenResponse`, `UserOut`, `UserCreate`, `UserUpdate`, `ResetPasswordRequest`, `ChangePasswordRequest`.
2. **Currency & Category**:
   - `CurrencyOut`, `CurrencyCreate`, `CurrencyUpdate`.
   - `CategoryOut`, `CategoryCreate`.
3. **Transactions (Income & Expense)**:
   - `IncomeCreate` (form multipart: date, party, category_id, amount, payment_method, description, file opsional).
   - `ExpenseConfirm` (date, party, category_id, amount, payment_method, description).
   - `ExpenseUpdate` (koreksi draft AI sebelum confirm).
   - `TransactionOut`: representasi data gabungan untuk tabel transaksi frontend.
   - `SummaryResponse`: total_income, total_expense, balance, by_category, by_currency.

---

### Langkah 6: Backend Services
1. **`backend/app/services/storage.py`**:
   - Validasi file (ukuran <= 5MB, format: jpg, jpeg, png, webp, pdf).
   - Hitung SHA-256 untuk mendeteksi duplikat upload.
   - Simpan file ke `uploads/<user_id>/<uuid>.<ext>`.
   - Fungsi untuk menghapus file fisik ketika transaksi dibatalkan/dihapus.
2. **`backend/app/services/ai_extractor.py`**:
   - Pengecekan kuota harian upload AI per user.
   - Integrasi `google-genai` dengan model `gemini-2.5-flash`.
   - Parsing respons JSON terstruktur: tanggal, vendor/toko, total amount, kategori (dicocokkan ke kategori user), deskripsi.
   - Error handling & graceful fallback: bila AI gagal membaca struk, kembalikan status `failed` dan data draft kosong agar user tetap bisa mengisi manual.

---

### Langkah 7: Backend Routers (`backend/app/routers/`)
1. **`auth.py`**: `/api/auth/login`, `/api/auth/me`, `/api/auth/change-password`.
2. **`users.py`**: CRUD user khusus admin: list user, create user, update status/role (hanya nonaktifkan, tidak ada delete), reset password.
3. **`categories.py`**: list kategori (default global + milik user), tambah kategori baru.
4. **`currencies.py`**: list mata uang, admin create/toggle active.
5. **`incomes.py`**: POST create pemasukan via form `multipart/form-data`, GET detail, PATCH edit, DELETE.
6. **`expenses.py`**:
   - `POST /upload`: upload foto struk -> AI parsing -> simpan transaksi status `draft`.
   - `PATCH /{id}`: update data draft hasil AI.
   - `POST /{id}/confirm`: validasi kelengkapan data -> ubah status menjadi `confirmed`.
   - `GET /drafts`: list draft pengeluaran yang belum dikonfirmasi.
7. **`transactions.py`**:
   - `GET /`: list riwayat transaksi gabungan (filter: tipe, kategori, tanggal, status).
   - `GET /{id}/attachment`: unduh file bukti aman dengan verifikasi kepemilikan user.
   - `DELETE /{id}`: hapus transaksi beserta file fisiknya.
8. **`reports.py`**:
   - `GET /summary`: agregasi total pemasukan, pengeluaran, saldo, dan rincian per kategori per rentang tanggal.

---

### Langkah 8: Frontend Scaffolding & Setup
1. **Inisialisasi Vite + React**:
   - Di folder `frontend/` menggunakan React SPA.
   - Pasang Tailwind CSS v3 / v4 (`tailwindcss`, `postcss`, `autoprefixer`).
   - Pasang `react-router-dom`, `lucide-react` (icon), `clsx`, `tailwind-merge`.
2. **`vite.config.js`**:
   - Setup proxy API: permintaan `/api` diarahkan ke `http://localhost:8000`.
3. **`frontend/src/api/client.js`**:
   - Wrapper `fetch` otomatis menyisipkan header `Authorization: Bearer <token>`.
   - Menangani auto-logout (redirect ke `/login`) saat token kedaluwarsa (401).

---

### Langkah 9: Frontend Context & Layout
1. **`AuthContext.jsx`**:
   - Mengelola state `user`, `token`, fungsi `login()`, `logout()`, dan pengecekan role `isAdmin`.
2. **Komponen Layout (`Navbar.jsx`, `Layout.jsx`)**:
   - Navigasi responsif (desktop & mobile drawer).
   - Menu: Dashboard, Transaksi, Draft (dengan badge counter), Tambah Pengeluaran, Tambah Pemasukan.
   - Menu khusus Admin: Manage User, Mata Uang.
   - Dropdown profil: Nama, Role, tombol Ganti Password, dan Logout.
3. **Komponen UI Bersama**:
   - `Toast.jsx`: notifikasi sukses / error.
   - `Modal.jsx`: dialog pop-up konfirmasi dan preview bukti lampiran (gambar/PDF).
   - `SummaryCard.jsx`: kartu statistik ringkasan nominal.

---

### Langkah 10: Frontend Halaman (Pages)
1. **`Login.jsx`**: form login User ID dan password, feedback error jika akun nonaktif atau kredensial salah.
2. **`Dashboard.jsx`**:
   - Filter rentang waktu (Bulan Ini, 30 Hari Terakhir, Custom).
   - Kartu metrik: Total Pemasukan, Total Pengeluaran, Saldo Bersih.
   - Banner peringatan jika ada pengeluaran draft yang belum dikonfirmasi.
   - Tabel 5 transaksi terbaru dengan shortcut tombol lihat semua.
   - Rincian pengeluaran per kategori.
3. **`AddExpense.jsx` (Upload Bukti & Review AI)**:
   - Area drag & drop / klik upload foto invoice/struk (mendukung capture kamera HP).
   - Animasi loading saat Gemini AI mengekstrak data.
   - Form review hasil AI: Tanggal, Vendor, Kategori (dropdown), Nominal (rupiah), Metode Pembayaran, Catatan.
   - Tombol "Simpan sebagai Draft" atau "Konfirmasi Pengeluaran".
4. **`Drafts.jsx`**:
   - Daftar kartu atau tabel struk yang masih berstatus `draft`.
   - Tombol review cepat untuk mengedit dan konfirmasi langsung.
5. **`AddIncome.jsx`**:
   - Form input manual: Tanggal, Sumber Pemasukan, Kategori, Nominal, Metode Pembayaran, Catatan.
   - Input file bukti transfer/invoice opsional dengan preview thumbnail.
6. **`Transactions.jsx`**:
   - Tabel riwayat transaksi dengan filter: Jenis (Semua/Masuk/Keluar), Kategori, Tanggal Mulai & Akhir.
   - Badge status (`draft` / `confirmed`) dan badge tipe.
   - Tombol aksi: Preview Bukti (modal), Edit, Hapus (dengan konfirmasi).
7. **`ManageUsers.jsx` (Admin Only)**:
   - Tabel user: Username, Nama, Role, Status Aktif, Tanggal Dibuat.
   - Modal Tambah User (Username, Nama, Password Awal, Role).
   - Tombol Reset Password & Tombol Toggle Aktif/Nonaktifkan (dengan konfirmasi).
8. **`Currencies.jsx` (Admin Only)**:
   - Tabel mata uang aktif dan nonaktif.
   - Form tambah mata uang baru & tombol toggle status.
9. **`ChangePassword.jsx`**:
   - Form ubah password sendiri (password lama, password baru, konfirmasi).

---

### Langkah 11: Pengujian & Verifikasi
1. **Unit & Integration Test Backend (`backend/tests/`)**:
   - `test_auth.py`: login sukses, password salah, user nonaktif ditolak, akses endpoint terproteksi.
   - `test_users.py`: admin bisa buat user dan nonaktifkan; non-admin mendapat 403.
   - `test_transactions.py`: user A tidak bisa melihat transaksi user B (isolasi data), pemasukan dengan file, pengeluaran confirm.
   - `test_ai_extractor.py`: ekstraksi AI di-mocking tanpa memanggil API Google sungguhan.
2. **Verifikasi E2E Manual**:
   - Jalankan `npm run dev` dari root.
   - Login admin default dari `.env`.
   - Tambah user staf baru via Manage User.
   - Login sebagai user baru, input pemasukan manual dengan bukti transfer.
   - Upload struk pengeluaran, pastikan AI mengisi form draft, review dan confirm.
   - Cek dashboard dan laporan transaksi.

## Pertanyaan Terbuka
1. ~~Penyedia AI~~ → **OpenRouter AI (default: google/gemini-2.5-flash)**.
2. ~~Database~~ → **MySQL**.
3. ~~Single/multi-user~~ → **Multi-user**.
4. ~~Mata uang~~ → **Tabel `currencies`, IDR aktif saja untuk sekarang**.
5. ~~Frontend~~ → **Ya, folder terpisah; rekomendasi React + Vite + Tailwind**.
6. ~~Kategori~~ → **Tabel `categories`** (Kategori terisolasi penuh per user + onboarding auto-seed bawaan).
7. ~~Registrasi~~ → **Tidak ada registrasi; admin membuat akun lewat halaman Manage User**.
8. ~~MySQL~~ → **Terpasang lokal dulu; VPS dipasang belakangan** (tanpa docker-compose).
9. ~~Password admin~~ → **Tersimpan aman di DB via argon2id**.
10. ~~Hapus user~~ → **Hanya nonaktifkan**.

## Arsitektur Integrasi Hermes AI Agent (VPS & Telegram Bot)

### Konsep
Pengguna berencana menginstal **Hermes AI Agent** pada VPS yang sama dengan aplikasi Simple Cashflow. Hermes Agent terhubung ke bot Telegram, sehingga pengguna dapat mencatat pengeluaran harian dan mengecek ringkasan kas cukup melalui chat Telegram (mengirim foto struk / nota langsung dari HP).

### Skema Arsitektur
```
[User Telegram di HP]
        │
        │ Kirim Foto Struk / Chat Pertanyaan
        ▼
[Telegram Bot API]
        │
        ▼
[Hermes AI Agent di VPS] (Python / Node.js / CLI)
        │
        │ Memiliki akun khusus (User ID & Password)
        │ Mengonsumsi REST API via Bearer Token JWT
        ▼
[FastAPI Backend - http://127.0.0.1:8000]
        │
        ├── POST /api/auth/login                (Dapatkan token JWT)
        ├── POST /api/expenses/upload           (Upload file foto struk -> AI ekstraksi draft)
        ├── POST /api/expenses/{id}/confirm     (Konfirmasi draft jadi transaksi)
        ├── POST /api/expenses/drafts/approve-all (Approve semua draft sekaligus)
        ├── GET  /api/reports/summary           (Ringkasan pemasukan, pengeluaran, saldo)
        └── GET  /api/transactions              (Riwayat transaksi kas)
```

### Panduan Implementasi Agent
1. **Buat Akun Khusus untuk Agent**:
   - Login ke web sebagai `admin` -> menu **Kelola Pengguna**.
   - Tambah user baru, misalnya:
     - User ID: `agent_hermes`
     - Nama: `Hermes AI Telegram Bot`
     - Password: `PasswordKuatAgent123!`
     - Role: `user`
2. **Setup Kategori Akun Agent**:
   - Login sekali sebagai `agent_hermes` di browser atau via API endpoint `POST /api/categories/seed-defaults` agar akun memiliki kategori standar lengkap.
3. **Endpoint Utama untuk Agent**:
   - `POST /api/auth/login`: Mengambil `access_token` JWT. Simpan token ini dan perbarui jika kedaluwarsa (24 jam).
   - `POST /api/expenses/upload`: Mengirim foto struk dalam bentuk `multipart/form-data` dengan field `file`.
   - `POST /api/expenses/{id}/confirm`: Mengonfirmasi draft menjadi transaksi kas aktif.
   - `POST /api/expenses/drafts/approve-all`: Menyetujui semua draft struk yang pending sekaligus.
   - `GET /api/reports/summary`: Mengambil ringkasan keuangan untuk menjawab pertanyaan user di chat.


## Keputusan Sejauh Ini
- MySQL, Google AI Studio (Gemini), multi-user (JWT), mata uang via tabel `currencies` (IDR aktif).
- Tanpa `expense_items`: hanya simpan hasil akhir; satu file bukti per transaksi (expense & income); income tanpa AI.
- Satu tabel `transactions` (kolom `type`, `user_id`, `currency_code`), tabel `categories`, `currencies`, dan `users` terpisah.
- Monorepo `backend/` + `frontend/`, dijalankan bersamaan dengan `npm run dev`.
- Tanpa registrasi; admin mengelola user lewat halaman Manage User. Seed user awal `admin`; password diambil dari `.env` (kuat), tanpa paksa ganti password. User hanya bisa dinonaktifkan.
