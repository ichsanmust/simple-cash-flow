import base64
import concurrent.futures
from datetime import date
import json
import logging
import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AIModel, AppSetting, Category, Transaction

log = logging.getLogger(__name__)

AI_TIMEOUT_SECONDS = 30
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def get_active_ai_config(db: Session | None = None) -> tuple[str, str]:
    """
    Mengambil API Key OpenRouter dan Model aktif dari Database (dengan fallback ke settings).
    Returns (openrouter_api_key, active_model_id).
    """
    api_key = settings.openrouter_api_key or ""
    active_model = "google/gemini-2.5-flash"

    if db:
        # Cek API Key dari database
        key_setting = db.query(AppSetting).filter(AppSetting.key == "openrouter_api_key").first()
        if key_setting and key_setting.value and key_setting.value.strip():
            api_key = key_setting.value.strip()

        # Cek Model aktif dari tabel ai_models
        active_model_row = db.query(AIModel).filter(AIModel.is_active.is_(True)).first()
        if active_model_row:
            active_model = active_model_row.model_id
        else:
            model_setting = db.query(AppSetting).filter(AppSetting.key == "active_model_id").first()
            if model_setting and model_setting.value and model_setting.value.strip():
                active_model = model_setting.value.strip()

    return api_key, active_model


def test_ai_connection(api_key: str, model_id: str) -> dict:
    """Menguji koneksi ke OpenRouter dengan model tertentu."""
    import time

    if not api_key:
        return {"success": False, "message": "API Key OpenRouter tidak boleh kosong"}

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Simple Cashflow Test",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_id or "google/gemini-2.5-flash",
        "messages": [
            {"role": "user", "content": "Jawab singkat dalam satu kata: OK"}
        ],
        "max_tokens": 10,
    }

    start = time.perf_counter()
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(OPENROUTER_URL, headers=headers, json=payload)
            latency_ms = int((time.perf_counter() - start) * 1000)

            if resp.status_code == 200:
                data = resp.json()
                reply = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                return {
                    "success": True,
                    "message": f"Koneksi sukses! Model {model_id} merespons dalam {latency_ms} ms ({reply}).",
                    "latency_ms": latency_ms,
                    "model": model_id,
                }
            elif resp.status_code == 401:
                return {"success": False, "message": "API Key OpenRouter tidak valid (401 Unauthorized)"}
            elif resp.status_code == 402:
                return {"success": False, "message": "Kredit/saldo OpenRouter tidak mencukupi (402 Insufficient Credits)"}
            elif resp.status_code == 404:
                return {"success": False, "message": f"Model '{model_id}' tidak ditemukan di OpenRouter (404 Not Found)"}
            else:
                err_text = resp.text[:200]
                return {"success": False, "message": f"Error OpenRouter ({resp.status_code}): {err_text}"}
    except httpx.TimeoutException:
        return {"success": False, "message": "Koneksi ke OpenRouter melebihi batas waktu (Timeout 15 detik)"}
    except Exception as e:
        return {"success": False, "message": f"Gagal menghubungi server OpenRouter: {str(e)}"}

SYSTEM_PROMPT = """
Anda adalah asisten AI akuntansi yang bertugas mengekstrak data dari foto/gambar struk pembelian, faktur, atau kuitansi pengeluaran.
Keluarkan JSON HANYA dalam format berikut:
{
  "date": "YYYY-MM-DD atau null jika tidak jelas",
  "vendor": "Nama toko/perusahaan atau null",
  "total": integer angka total pembayaran bersih akhir dalam rupiah tanpa titik/koma/simbol, atau null jika tidak terbaca,
  "currency": "IDR",
  "category": "salah satu kategori dari daftar yang disediakan, atau lainnya",
  "description": "ringkasan singkat belanjaan/layanan (maksimal 1 kalimat)"
}
Jangan menambahkan teks markdown atau penjelasan di luar JSON murni.
"""


def check_user_daily_limit(db: Session, user_id: int) -> bool:
    """Mengecek apakah user sudah melewati batas harian upload AI."""
    today = date.today()
    count = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.user_id == user_id,
            Transaction.input_method == "ai_receipt",
            func.date(Transaction.created_at) == today,
        )
        .scalar()
        or 0
    )
    limit = settings.ai_daily_limit_per_user
    setting_row = db.query(AppSetting).filter(AppSetting.key == "ai_daily_limit_per_user").first()
    if setting_row and setting_row.value:
        try:
            limit = int(setting_row.value.strip())
        except ValueError:
            pass
    return count < limit


def _extract_json_from_text(text: str) -> dict:
    """Helper untuk mem-parse JSON bahkan jika terbungkus format markdown."""
    clean = text.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        clean = "\n".join(lines).strip()

    try:
        data = json.loads(clean)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # Cari substring kurung kurawal pertama { hingga terakhir }
    s = clean.find("{")
    e = clean.rfind("}")
    if s != -1 and e != -1 and e > s:
        data = json.loads(clean[s : e + 1])
        if isinstance(data, dict):
            return data

    raise ValueError(f"Tidak dapat menemukan format JSON yang valid: {text[:100]}")


def _call_openrouter_api(
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    api_key: str,
    model_id: str,
) -> str:
    """Memanggil OpenRouter API menggunakan format chat completions dengan lampiran gambar."""
    b64_img = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_img}"

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Simple Cashflow",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_id or "google/gemini-2.5-flash",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "response_format": {"type": "json_object"},
    }

    with httpx.Client(timeout=float(AI_TIMEOUT_SECONDS)) as client:
        resp = client.post(OPENROUTER_URL, headers=headers, json=payload)

        if resp.status_code != 200:
            err_msg = ""
            try:
                err_data = resp.json()
                err_msg = err_data.get("error", {}).get("message") or resp.text
            except Exception:
                err_msg = resp.text

            if resp.status_code == 401:
                raise ValueError("API Key OpenRouter tidak valid atau belum diisi. Periksa menu Model AI.")
            elif resp.status_code == 402:
                raise ValueError("Kredit/saldo OpenRouter tidak mencukupi (Insufficient Credits). Silakan isi saldo di https://openrouter.ai/credits")
            elif resp.status_code == 429:
                raise ValueError("Batas rate limit OpenRouter tercapai. Tunggu beberapa saat sebelum mencoba lagi.")
            elif resp.status_code == 404:
                raise ValueError(f"Model '{model_id}' tidak ditemukan di OpenRouter.")
            else:
                raise ValueError(f"Error OpenRouter ({resp.status_code}): {err_msg}")

        result_json = resp.json()
        choices = result_json.get("choices", [])
        if not choices:
            raise ValueError("OpenRouter tidak mengembalikan hasil teks respons.")
        return choices[0].get("message", {}).get("content", "") or "{}"


def _call_gemini_api(image_bytes: bytes, mime_type: str, prompt: str) -> str:
    """Fallback memanggil Google Gemini langsung jika OPENROUTER_API_KEY tidak ada."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key.strip())
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            prompt,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )
    return response.text or "{}"


def extract_expense_from_receipt(
    image_bytes: bytes,
    mime_type: str,
    available_categories: list[str],
    db: Session | None = None,
) -> tuple[str, dict, dict | None]:
    """
    Mengekstrak data struk memakai OpenRouter AI (atau Gemini fallback) dengan timeout 30 detik.
    Return (ai_status: 'success' | 'failed', parsed_data: dict, raw_json: dict | None)
    """
    openrouter_api_key, active_model_id = get_active_ai_config(db)

    has_openrouter = bool(openrouter_api_key and openrouter_api_key.strip())
    has_gemini = bool(settings.gemini_api_key and settings.gemini_api_key.strip())

    if not has_openrouter and not has_gemini:
        err_msg = (
            "API Key OpenRouter belum dikonfigurasi. "
            "Silakan masukkan API key Anda di menu Model AI (Pengaturan AI) pada navigasi atas."
        )
        log.warning(err_msg)
        return "failed", {}, {"error": err_msg}

    cat_list_str = ", ".join(available_categories) if available_categories else "makanan, transport, utilitas, belanja, kesehatan, hiburan, pendidikan, lainnya"
    prompt = f"{SYSTEM_PROMPT}\nDaftar kategori yang valid: [{cat_list_str}]."

    def _worker():
        if has_openrouter:
            return _call_openrouter_api(
                image_bytes=image_bytes,
                mime_type=mime_type,
                prompt=prompt,
                api_key=openrouter_api_key,
                model_id=active_model_id,
            )
        else:
            return _call_gemini_api(image_bytes, mime_type, prompt)

    # Jalankan panggilan dengan batas timeout 30 detik
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_worker)
        try:
            raw_text = future.result(timeout=AI_TIMEOUT_SECONDS)
        except concurrent.futures.TimeoutError:
            err_msg = f"Analisis AI melebihi batas waktu {AI_TIMEOUT_SECONDS} detik (Timeout). Silakan periksa koneksi internet atau coba kembali."
            log.error(err_msg)
            return "failed", {}, {"error": err_msg}
        except httpx.TimeoutException:
            err_msg = f"Koneksi HTTP ke server AI timeout setelah {AI_TIMEOUT_SECONDS} detik. Silakan coba kembali."
            log.error(err_msg)
            return "failed", {}, {"error": err_msg}
        except Exception as e:
            raw_err = str(e)
            log.exception("Gagal memproses struk dengan AI: %s", raw_err)
            return "failed", {}, {"error": raw_err}

    try:
        data = _extract_json_from_text(raw_text)
        # Normalisasi kategori
        cat = str(data.get("category", "")).lower().strip()
        if cat not in [c.lower() for c in available_categories]:
            cat = "lainnya"
        data["category"] = cat
        return "success", data, data
    except Exception as e:
        log.exception("Gagal parsing JSON output AI: %s", str(e))
        return "failed", {}, {"error": f"Gagal membaca output JSON dari AI: {str(e)}"}
