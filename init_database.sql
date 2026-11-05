-- ====================================================================
-- Script Inisialisasi Database MySQL untuk Simple Cashflow
-- Jalankan skrip ini dengan user root atau user berhak akses CREATE DATABASE:
--
-- Contoh via terminal:
--   mysql -u root -p < init_database.sql
-- ====================================================================

-- 1. Buat Database
CREATE DATABASE IF NOT EXISTS `cashflow`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `cashflow`;

-- 2. (Opsional) Buat User Khusus Aplikasi
-- Ganti 'password_rahasia' dengan password yang kuat untuk MySQL di server VPS Anda.
-- CREATE USER IF NOT EXISTS 'cashflow_user'@'localhost' IDENTIFIED BY 'password_rahasia';
-- GRANT ALL PRIVILEGES ON `cashflow`.* TO 'cashflow_user'@'localhost';
-- FLUSH PRIVILEGES;

-- ====================================================================
-- 3. Definisi Tabel
-- ====================================================================

-- Tabel 1: Users (Pengguna Sistem)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(10) NOT NULL DEFAULT 'user',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 2: Currencies (Mata Uang)
CREATE TABLE IF NOT EXISTS `currencies` (
  `code` VARCHAR(3) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `symbol` VARCHAR(5) NOT NULL,
  `decimal_places` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 3: Categories (Kategori Pemasukan & Pengeluaran)
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NULL,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(10) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_categories_user_id` (`user_id`),
  CONSTRAINT `fk_categories_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  UNIQUE KEY `uq_user_type_name` (`user_id`, `type`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 4: Transactions (Transaksi Pemasukan & Pengeluaran)
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `type` VARCHAR(10) NOT NULL,
  `trx_date` DATE NULL,
  `party` VARCHAR(200) NULL,
  `description` TEXT NULL,
  `category_id` INT NULL,
  `amount` BIGINT NULL,
  `currency_code` VARCHAR(3) NOT NULL DEFAULT 'IDR',
  `payment_method` VARCHAR(30) NULL,
  `status` VARCHAR(10) NOT NULL DEFAULT 'draft',
  `input_method` VARCHAR(12) NOT NULL DEFAULT 'form',
  `attachment_path` VARCHAR(300) NULL,
  `attachment_name` VARCHAR(200) NULL,
  `attachment_mime` VARCHAR(50) NULL,
  `attachment_sha256` VARCHAR(64) NULL,
  `ai_status` VARCHAR(10) NULL,
  `ai_raw_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trx_user_id` (`user_id`),
  KEY `idx_trx_date` (`trx_date`),
  KEY `idx_trx_category_id` (`category_id`),
  KEY `idx_trx_currency_code` (`currency_code`),
  KEY `idx_trx_sha256` (`attachment_sha256`),
  CONSTRAINT `fk_trx_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trx_category_id` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_trx_currency_code` FOREIGN KEY (`currency_code`) REFERENCES `currencies` (`code`) ON DELETE RESTRICT,
  CONSTRAINT `chk_trx_type` CHECK (`type` IN ('income', 'expense')),
  CONSTRAINT `chk_trx_amount` CHECK (`amount` IS NULL OR `amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 5: AI Models (Daftar Model AI untuk Ekstraksi Struk)
CREATE TABLE IF NOT EXISTS `ai_models` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `model_id` VARCHAR(150) NOT NULL,
  `provider` VARCHAR(50) NOT NULL DEFAULT 'OpenRouter',
  `description` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  `is_custom` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ai_models_model_id` (`model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 6: App Settings (Konfigurasi Aplikasi / API Keys di Database)
CREATE TABLE IF NOT EXISTS `app_settings` (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NULL,
  `description` VARCHAR(255) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 4. Data Awal (Seed Data)
-- ====================================================================

-- 4.1 Mata Uang Default (IDR)
INSERT IGNORE INTO `currencies` (`code`, `name`, `symbol`, `decimal_places`, `is_active`)
VALUES ('IDR', 'Rupiah Indonesia', 'Rp', 0, 1);

-- 4.2 Kategori Default Global (Pengeluaran)
INSERT IGNORE INTO `categories` (`user_id`, `name`, `type`, `is_active`) VALUES
(1, 'makanan', 'expense', 1),
(1, 'transport', 'expense', 1),
(1, 'utilitas', 'expense', 1),
(1, 'belanja', 'expense', 1),
(1, 'kesehatan', 'expense', 1),
(1, 'hiburan', 'expense', 1),
(1, 'pendidikan', 'expense', 1),
(1, 'Sedekah', 'expense', 1),
(1, 'lainnya', 'expense', 1);

-- 4.3 Kategori Default Global (Pemasukan)
INSERT IGNORE INTO `categories` (`user_id`, `name`, `type`, `is_active`) VALUES
(1, 'gaji', 'income', 1),
(1, 'usaha', 'income', 1),
(1, 'investasi', 'income', 1),
(1, 'hadiah', 'income', 1),
(1, 'lainnya', 'income', 1);

-- 4.4 Akun Administrator Awal
INSERT INTO `users` (`id`, `username`, `password_hash`, `name`, `role`, `is_active`, `created_at`)
VALUES (1, 'admin', '$argon2id$v=19$m=65536,t=3,p=4$2fBkZDgZODzLlYSUTB8aLA$RhF+Tng91CkJ92hRRapPjSKgleaoUDATvN4DCUbQbyU', 'Administrator', 'admin', 1, '2026-11-02 17:45:25')
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

-- 4.5 Data Awal Model AI (Tersimpan di Database)
INSERT IGNORE INTO `ai_models` (`name`, `model_id`, `provider`, `description`, `is_active`, `is_custom`) VALUES
('Google Gemini 2.5 Flash', 'google/gemini-2.5-flash', 'OpenRouter', 'Rekomendasi utama: sangat cepat, pembacaan struk akurat, hemat biaya', 1, 0),
('Google Gemini 2.5 Flash Lite', 'google/gemini-2.5-flash-lite', 'OpenRouter', 'Versi ringan berkecepatan tinggi dengan biaya token minimal', 0, 0),
('Google Gemini 2.5 Pro', 'google/gemini-2.5-pro', 'OpenRouter', 'Model penalaran tinggi untuk struk kompleks, tabel panjang, atau gambar buram', 0, 0),
('OpenAI GPT-4o Mini', 'openai/gpt-4o-mini', 'OpenRouter', 'Model multimodal cerdas & cepat dari OpenAI', 0, 0),
('OpenAI GPT-4o', 'openai/gpt-4o', 'OpenRouter', 'Model unggulan multimodal OpenAI dengan akurasi pengenalan teks tinggi', 0, 0),
('Anthropic Claude 3.5 Sonnet', 'anthropic/claude-3.5-sonnet', 'OpenRouter', 'Kemampuan pemahaman visual tingkat lanjut dan struktur dokumen', 0, 0),
('Qwen 2.5 VL 72B Instruct', 'qwen/qwen-2.5-vl-72b-instruct', 'OpenRouter', 'Model vision open-source terbaik untuk OCR dan pemahaman gambar', 0, 0);

-- 4.6 Pengaturan Aplikasi Awal
INSERT IGNORE INTO `app_settings` (`key`, `value`, `description`) VALUES
('active_model_id', 'google/gemini-2.5-flash', 'Model ID AI yang aktif digunakan untuk ekstraksi struk'),
('openrouter_api_key', '', 'API Key OpenRouter AI'),
('ai_daily_limit_per_user', '20', 'Batas harian analisis struk AI per pengguna'),
('upload_dir', 'uploads', 'Folder penyimpanan file bukti unggahan'),
('max_upload_mb', '5', 'Maksimal ukuran unggahan file dalam MB');


