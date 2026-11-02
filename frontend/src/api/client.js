const TOKEN_KEY = "scashflow_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Jika body bukan FormData, pasang Content-Type: application/json
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Permintaan melebihi batas waktu (Timeout 30 detik). Silakan periksa koneksi atau coba lagi.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    // Jika terjadi saat login, tampilkan pesan error asli dari backend (User ID / password salah)
    if (endpoint.includes("/auth/login")) {
      throw new Error(data.detail || "User ID atau password tidak sesuai");
    }

    setToken(null);
    if (!window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
    throw new Error(data.detail || "Sesi telah berakhir. Silakan login kembali.");
  }

  if (response.status === 204) {
    return null;
  }

  // Jika response adalah file / blob
  const contentType = response.headers.get("content-type");
  if (contentType && (contentType.includes("application/pdf") || contentType.includes("image/"))) {
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    let errorMsg = "Terjadi kesalahan pada server.";
    if (typeof data.detail === "string") {
      errorMsg = data.detail;
    } else if (Array.isArray(data.detail)) {
      // Format pesan validasi 422 dari FastAPI
      errorMsg = data.detail
        .map((err) => `${err.loc ? err.loc.slice(1).join(" -> ") : "field"}: ${err.msg}`)
        .join("; ");
    } else if (data.detail && typeof data.detail === "object") {
      errorMsg = JSON.stringify(data.detail);
    } else if (data.message) {
      errorMsg = data.message;
    }
    throw new Error(errorMsg);
  }

  return data;
}

export const authApi = {
  login: (username, password) =>
    apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => apiRequest("/api/auth/me"),
  changePassword: (old_password, new_password) =>
    apiRequest("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password, new_password }),
    }),
};

export const usersApi = {
  list: () => apiRequest("/api/users"),
  create: (data) =>
    apiRequest("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiRequest(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  resetPassword: (id, new_password) =>
    apiRequest(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password }),
    }),
};

export const categoriesApi = {
  list: (type, includeInactive = false) => {
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    if (includeInactive) params.append("include_inactive", "true");
    const qs = params.toString();
    return apiRequest(`/api/categories${qs ? `?${qs}` : ""}`);
  },
  check: () => apiRequest("/api/categories/check"),
  seedDefaults: () =>
    apiRequest("/api/categories/seed-defaults", {
      method: "POST",
    }),
  create: (data) =>
    apiRequest("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiRequest(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiRequest(`/api/categories/${id}`, {
      method: "DELETE",
    }),
};

export const currenciesApi = {
  list: (includeInactive = false) =>
    apiRequest(`/api/currencies${includeInactive ? "?include_inactive=true" : ""}`),
  create: (data) =>
    apiRequest("/api/currencies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (code, data) =>
    apiRequest(`/api/currencies/${code}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

export const incomesApi = {
  create: (formData) =>
    apiRequest("/api/incomes", {
      method: "POST",
      body: formData,
    }),
};

export const expensesApi = {
  upload: (formData) =>
    apiRequest("/api/expenses/upload", {
      method: "POST",
      body: formData,
    }),
  getDrafts: () => apiRequest("/api/expenses/drafts"),
  updateDraft: (id, data) =>
    apiRequest(`/api/expenses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  confirm: (id, data) =>
    apiRequest(`/api/expenses/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  confirmAll: () =>
    apiRequest("/api/expenses/drafts/approve-all", {
      method: "POST",
    }),
  createManual: (formData) =>
    apiRequest("/api/expenses/manual", {
      method: "POST",
      body: formData,
    }),
};

export const transactionsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        qs.append(k, v);
      }
    });
    return apiRequest(`/api/transactions?${qs.toString()}`);
  },
  update: (id, data) =>
    apiRequest(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiRequest(`/api/transactions/${id}`, {
      method: "DELETE",
    }),
  getAttachmentBlob: (id) => apiRequest(`/api/transactions/${id}/attachment`),
};

export const reportsApi = {
  getSummary: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        qs.append(k, v);
      }
    });
    return apiRequest(`/api/reports/summary?${qs.toString()}`);
  },
};

export const aiModelsApi = {
  list: () => apiRequest("/api/ai-models"),
  getActive: () => apiRequest("/api/ai-models/active"),
  activate: (id) =>
    apiRequest(`/api/ai-models/${id}/activate`, {
      method: "POST",
    }),
  create: (data) =>
    apiRequest("/api/ai-models", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiRequest(`/api/ai-models/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiRequest(`/api/ai-models/${id}`, {
      method: "DELETE",
    }),
  updateSettings: (data) =>
    apiRequest("/api/ai-models/settings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  testConnection: (data = {}) =>
    apiRequest("/api/ai-models/test", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const settingsApi = {
  get: () => apiRequest("/api/settings"),
  update: (data) =>
    apiRequest("/api/settings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export function formatRupiah(amount, currencyCode = "IDR") {
  if (amount === null || amount === undefined || isNaN(amount)) return "Rp 0";
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currencyCode || "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `Rp ${Number(amount).toLocaleString("id-ID")}`;
  }
}

export function formatNumberWithDots(val) {
  if (val === null || val === undefined || val === "") return "";
  const cleanStr = String(val).replace(/\D/g, "");
  if (!cleanStr) return "";
  return new Intl.NumberFormat("id-ID").format(Number(cleanStr));
}

export function parseNumberFromDots(str) {
  if (!str) return 0;
  const cleanStr = String(str).replace(/\D/g, "");
  return cleanStr ? parseInt(cleanStr, 10) : 0;
}

