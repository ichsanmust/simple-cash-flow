# Simple Cashflow

Aplikasi pencatatan arus kas (cashflow) modern dan aman berbasis Python FastAPI dan React Vite + Tailwind CSS.
Mendukung:
- **Pengeluaran Otomatis (AI Vision)**: Unggah foto struk/invoice belanjaan, diekstrak secara instan menjadi format terstruktur oleh OpenRouter AI (Gemini 2.5 Flash / model vision lainnya), review, dan konfirmasi.
- **Approve Semua Draft (Bulk Confirm)**: Tombol 1-klik untuk menyetujui seluruh draft struk yang valid sekaligus.
- **Pemasukan Manual Terlindungi**: Formulir input manual untuk pemasukan sensitif beserta lampiran bukti transfer/slip gaji (disimpan lokal, tidak pernah dikirim ke pihak ketiga).
- **Tampilan Transaksi Excel (Handsontable)**: Tampilan spreadsheet penuh tanpa pagination, filter per kolom, pemilih bulan/tahun, formula bar, serta inline editing kolom Pihak & Keterangan dengan shortcut simpan `Ctrl+S` / `Cmd+S`.
- **Manajemen Kategori Multi-User**: Kategori terisolasi penuh per user, onboarding otomatis bagi user baru, dan 1-klik pembuatan kumpulan kategori standar (pemasukan & pengeluaran).
- **Multi-User & Hak Akses**: Setiap user memiliki data terisolasi. Akun dibuat dan dikelola oleh Admin (tidak ada registrasi terbuka).
- **Integrasi AI Agent**: Siap dihubungkan dengan AI Agent otonom (seperti Hermes AI Agent via Telegram) melalui REST API.
- **Mata Uang Fleksibel**: Tabel `currencies` dengan default `IDR`.

---

## Struktur Folder
```
simple-cash-flow/
├── package.json              # Skrip root: setup dan run berbarengan
├── IMPLEMENTATION_PLAN.md    # Dokumen spesifikasi teknis lengkap
├── backend/                  # FastAPI Application
│   ├── .env.example
│   ├── requirements.txt
│   ├── app/                  # Kode aplikasi backend
│   └── tests/                # Test suite pytest
└── frontend/                 # React SPA (Vite + Tailwind CSS)
    ├── package.json
    └── src/
```

---

## Prasyarat
- **Python 3.11+**
- **Node.js 20+**
- **MySQL 8.0+** (atau SQLite otomatis jika `DATABASE_URL` menggunakan SQLite)

---

## Teknologi & Dependensi
- **Backend (Python)** (`backend/requirements.txt`):
  - `FastAPI`, `Uvicorn`, `SQLAlchemy 2`, `PyMySQL`, `Alembic`, `Pydantic v2`, `PyJWT`, `Argon2-cffi`, `httpx`
- **Frontend (JavaScript)** (`frontend/package.json`):
  - `React 18`, `Vite`, `Tailwind CSS`
  - `Handsontable 18.1.2`: Engine spreadsheet interaktif untuk fitur **Transaksi (Excel)** (`/transactions-excel`) dengan inline editing, formula bar, dan navigasi sel layaknya Microsoft Excel.
  - `Lucide React`: Icon pack modern.
  - `React Router DOM`: Navigasi rute SPA.

---

## Panduan Menjalankan

### 1. Inisialisasi Database MySQL
Anda dapat menginisialisasi database MySQL (di lokal maupun di VPS) menggunakan file [init_database.sql](file:///Users/ichsanmust/Web%20Programming/experiment/simple-cash-flow/init_database.sql):
```bash
# Masuk ke MySQL / jalankan skrip SQL:
mysql -u root -p < init_database.sql
```
Skrip ini akan otomatis membuat database `cashflow`, 4 tabel lengkap (`users`, `currencies`, `categories`, `transactions`), constraint validasi, serta data awal (mata uang IDR & kategori default).

### 2. Konfigurasi Lingkungan (`backend/.env`)
Salin file template `.env`:
```bash
cp backend/.env.example backend/.env
```
Sesuaikan konfigurasi:
- `DATABASE_URL`: URL koneksi MySQL (misal: `mysql+pymysql://user:password@localhost:3306/cashflow`) atau SQLite (`sqlite:///./cashflow.db`).
- `JWT_SECRET`: String acak untuk signing JWT.
- `AI_DAILY_LIMIT_PER_USER`: Batas harian analisis struk AI per pengguna (default: 20).

> [!NOTE]
> Akun Admin, daftar model AI, dan API Key OpenRouter tersimpan di database dan dikonfigurasi melalui antarmuka web (menu **Model AI**), tidak disimpan di file `.env`.

### 3. Instalasi Dependensi (Sekali Saja)
Jalankan dari direktori root:
```bash
npm install
npm run setup
```
*(Script ini akan otomatis membuat virtualenv `.venv` di backend, menginstal library Python, dan menginstal node_modules di frontend).*

### 4. Menjalankan Aplikasi (Satu Perintah)
Cukup jalankan dari direktori root:
```bash
npm run dev
```
Perintah ini akan menyalakan:
- **Backend FastAPI**: http://localhost:8000 (Dokumentasi API di `/docs`)
- **Frontend Web**: http://localhost:5173

---

## Kredensial Awal Administrator
Akun Administrator diinisialisasi langsung ke database melalui `init_database.sql` (tidak lagi disimpan di file `.env`):
- **User ID**: `admin`
- **Password**: `8dkBQkXLM14Ad454nT7u*47k`

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=8dkBQkXLM14Ad454nT7u*47k
```

---

## Manajemen Model AI (Tersimpan di Database)
Daftar model AI dan API Key dikelola sepenuhnya melalui database dan menu UI **Model AI** di dashboard web (khusus Admin):
- **Model Bawaan**:
  - `google/gemini-2.5-flash` (Aktif secara default - cepat, akurat membaca nota, biaya hemat)
  - `google/gemini-2.5-flash-lite`
  - `google/gemini-2.5-pro`
  - `openai/gpt-4o-mini`
  - `openai/gpt-4o`
  - `anthropic/claude-3.5-sonnet`
  - `qwen/qwen-2.5-vl-72b-instruct`
- **Fitur Menu Model AI**:
  - **Pilih & Ganti Model Aktif**: 1-klik untuk memilih model yang digunakan aplikasi.
  - **Tambah Model Kustom**: Mendukung penambahan model OpenRouter baru secara fleksibel.
  - **Kelola API Key**: Simpan & perbarui API Key OpenRouter langsung dari antarmuka web.
  - **Tes Koneksi**: Tombol uji latensi dan koneksi ke model AI secara langsung.

---

## Integrasi Hermes AI Agent di VPS (via Telegram Bot)

Anda dapat mengintegrasikan **Hermes AI Agent** (atau bot otonom lainnya) yang berjalan di VPS dan terhubung ke **Telegram**. Dengan integrasi ini, Anda cukup mengirimkan foto struk belanjaan langsung ke chat Telegram dari HP, dan Agent akan memprosesnya otomatis ke aplikasi Simple Cashflow.

```
[Pengguna di Telegram (HP)]
            │  (Kirim foto struk / ketik pertanyaan)
            ▼
   [Telegram Bot API]
            │
            ▼
[Hermes AI Agent di VPS]
            │  (REST API dengan JWT Token)
            ▼
[FastAPI Backend - http://127.0.0.1:8000]
   ├── POST /api/auth/login
   ├── POST /api/expenses/upload
   ├── POST /api/expenses/{id}/confirm
   ├── POST /api/expenses/drafts/approve-all
   └── GET  /api/reports/summary
```

---

### 1. Buat Akun Khusus untuk Agent
1. Buka antarmuka web Simple Cashflow, login sebagai **admin**.
2. Masuk ke menu **Kelola Pengguna** (`/admin/users`).
3. Klik **+ Tambah Pengguna** dan buat akun khusus:
   - **User ID**: `hermes_agent`
   - **Nama**: `Hermes Financial Assistant`
   - **Password**: `BuatPasswordKuat123!`
   - **Role**: `user`
4. Login sekali ke web dengan akun tersebut atau jalankan perintah seed kategori default:
   ```bash
   curl -X POST http://127.0.0.1:8000/api/categories/seed-defaults \
     -H "Authorization: Bearer <TOKEN_AGENT>"
   ```

---

### 2. Alur Interaksi Agent & REST API

#### A. Otentikasi (Mendapatkan Token JWT)
Setiap kali agent menyala atau token kedaluwarsa (setiap 24 jam), agent melakukan login:
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "hermes_agent", "password": "BuatPasswordKuat123!"}'
```
**Respons**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "username": "hermes_agent",
    "name": "Hermes Financial Assistant",
    "role": "user"
  }
}
```

#### B. Upload Foto Struk dari Telegram (AI Vision Extraction)
Saat pengguna mengirimkan foto struk/nota di chat Telegram:
1. Agent mengunduh file foto dari Telegram.
2. Agent mengirimkan file ke backend Simple Cashflow:
```bash
curl -X POST http://127.0.0.1:8000/api/expenses/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@struk_belanja.jpg"
```
**Respons (Status Draft)**:
```json
{
  "id": 14,
  "status": "draft",
  "party": "Indomaret Point",
  "amount": 54500,
  "currency_code": "IDR",
  "category_id": 4,
  "category_name": "belanja",
  "trx_date": "2026-11-02",
  "description": "Roti, kopi kaleng, dan air mineral",
  "has_attachment": true
}
```
Agent kemudian merangkum hasil ini ke pengguna di Telegram:
> *"Nota terdeteksi dari **Indomaret Point** sebesar **Rp 54.500** (Kategori: Belanja). Mau langsung saya catat sebagai pengeluaran?"*

#### C. Konfirmasi Transaksi (Approval)
Jika pengguna membalas *"Ya"*, *"Catat"*, atau *"Oke"*:
```bash
curl -X POST http://127.0.0.1:8000/api/expenses/14/confirm \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "trx_date": "2026-11-02",
    "party": "Indomaret Point",
    "category_id": 4,
    "amount": 54500,
    "currency_code": "IDR",
    "payment_method": "Online",
    "description": "Roti, kopi kaleng, dan air mineral"
  }'
```
Atau jika ingin menyetujui semua draft struk yang pending sekaligus:
```bash
curl -X POST http://127.0.0.1:8000/api/expenses/drafts/approve-all \
  -H "Authorization: Bearer <TOKEN>"
```

#### D. Menanyakan Saldo & Laporan Kas
Jika pengguna di Telegram bertanya: *"Berapa pengeluaran saya bulan ini?"*:
```bash
curl -X GET "http://127.0.0.1:8000/api/reports/summary?date_from=2026-11-01&date_to=2026-11-30" \
  -H "Authorization: Bearer <TOKEN>"
```
**Respons**:
```json
{
  "total_income": 12000000,
  "total_expense": 3450000,
  "balance": 8550000,
  "expense_by_category": {
    "makanan": 1200000,
    "belanja": 1500000,
    "transportasi": 750000
  },
  "income_by_category": {
    "gaji": 12000000
  },
  "pending_drafts": 0
}
```

---

### 3. Contoh Modul Python Helper untuk Hermes Agent
Simpan kode ini di VPS pada direktori project Hermes Agent (misal `cashflow_client.py`):

```python
import os
import requests

class SimpleCashflowClient:
    def __init__(self, base_url="http://127.0.0.1:8000", username="hermes_agent", password="BuatPasswordKuat123!"):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.token = None
        self.login()

    def login(self):
        url = f"{self.base_url}/api/auth/login"
        res = requests.post(url, json={"username": self.username, "password": self.password})
        res.raise_for_status()
        self.token = res.json()["access_token"]
        return self.token

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def upload_receipt(self, file_path: str):
        url = f"{self.base_url}/api/expenses/upload"
        with open(file_path, "rb") as f:
            files = {"file": f}
            res = requests.post(url, headers=self._headers(), files=files)
            if res.status_code == 401:
                self.login()
                res = requests.post(url, headers=self._headers(), files=files)
            res.raise_for_status()
            return res.json()

    def confirm_expense(self, draft_id: int, data: dict):
        url = f"{self.base_url}/api/expenses/{draft_id}/confirm"
        res = requests.post(url, headers=self._headers(), json=data)
        res.raise_for_status()
        return res.json()

    def approve_all_drafts(self):
        url = f"{self.base_url}/api/expenses/drafts/approve-all"
        res = requests.post(url, headers=self._headers())
        res.raise_for_status()
        return res.json()

    def get_summary(self, date_from=None, date_to=None):
        url = f"{self.base_url}/api/reports/summary"
        params = {}
        if date_from: params["date_from"] = date_from
        if date_to: params["date_to"] = date_to
        res = requests.get(url, headers=self._headers(), params=params)
        res.raise_for_status()
        return res.json()
```

---

### 4. System Prompt untuk Hermes AI Agent

Salin dan gunakan prompt berikut sebagai **System Prompt** pada konfigurasi Hermes AI Agent:

```markdown
Anda adalah "Hermes Cashflow Assistant", asisten keuangan pribadi yang terhubung dengan pengguna melalui bot Telegram dan terintegrasi langsung dengan backend Simple Cashflow via REST API.

TUGAS UTAMA ANDA:
1. Menerima gambar struk, nota, atau invoice belanjaan yang dikirim pengguna di chat Telegram.
2. Memanggil endpoint backend `POST /api/expenses/upload` untuk menganalisis struk secara otomatis menggunakan AI Vision.
3. Menampilkan ringkasan hasil pembacaan kepada pengguna dalam format rapi:
   - Nama Toko / Vendor: [vendor]
   - Tanggal: [YYYY-MM-DD]
   - Total Nominal: [Format Rupiah, misal: Rp 45.000]
   - Kategori: [kategori]
   - Keterangan: [deskripsi ringkas item]
   - ID Draft: [id]
4. Meminta konfirmasi singkat kepada pengguna: "Apakah data di atas sudah sesuai untuk dicatat ke buku kas?"
5. Jika pengguna menjawab "Ya", "Oke", "Betul", "Catat", atau sejenisnya:
   - Panggil endpoint `POST /api/expenses/{id}/confirm` (atau `POST /api/expenses/drafts/approve-all` jika pengguna meminta setujui semua).
   - Balas dengan konfirmasi bahwa pengeluaran telah resmi masuk ke buku kas.
6. Jika pengguna bertanya mengenai kondisi keuangan (misal: "Berapa pengeluaran saya bulan ini?", "Sisa saldo berapa?"):
   - Panggil endpoint `GET /api/reports/summary`.
   - Jawab dengan bahasa Indonesia yang santun, jelas, dan sertakan rincian pengeluaran per kategori.

PANDUAN PERILAKU:
- Selalu gunakan format Rupiah (Rp) dengan pemisah ribuan titik (contoh: Rp 125.000).
- Jika ada nominal yang tidak terbaca pada foto, minta pengguna mengetikkan nominalnya secara manual.
- Jangan pernah membeberkan kredensial teknis atau token autentikasi kepada pengguna.
```


