import React, { useEffect, useState } from "react";
import { AlertCircle, KeyRound, Loader2, ShieldCheck, UserCheck, UserPlus, UserX } from "lucide-react";
import { usersApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [modalResetOpen, setModalResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [createForm, setCreateForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "user",
  });
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { user: currentUser } = useAuth();
  const { addToast } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err) {
      addToast(err.message || "Gagal memuat daftar pengguna", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await usersApi.create(createForm);
      addToast(`User '${createForm.username}' berhasil dibuat!`);
      setModalCreateOpen(false);
      setCreateForm({ username: "", name: "", password: "", role: "user" });
      loadUsers();
    } catch (err) {
      addToast(err.message || "Gagal membuat pengguna", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      addToast("Anda tidak dapat menonaktifkan akun Anda sendiri", "error");
      return;
    }

    const actionText = targetUser.is_active ? "menonaktifkan" : "mengaktifkan kembali";
    if (!window.confirm(`Apakah Anda yakin ingin ${actionText} akun '${targetUser.username}'?`)) return;

    try {
      await usersApi.update(targetUser.id, { is_active: !targetUser.is_active });
      addToast(`Status akun '${targetUser.username}' berhasil diubah`);
      loadUsers();
    } catch (err) {
      addToast(err.message || "Gagal mengubah status pengguna", "error");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser || !resetPasswordValue) return;

    setSubmitting(true);
    try {
      await usersApi.resetPassword(selectedUser.id, resetPasswordValue);
      addToast(`Password untuk '${selectedUser.username}' berhasil direset!`);
      setModalResetOpen(false);
      setResetPasswordValue("");
      setSelectedUser(null);
    } catch (err) {
      addToast(err.message || "Gagal mereset password", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Pengguna</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola akun staf, hak akses, dan status pengguna sistem
          </p>
        </div>

        <button
          onClick={() => setModalCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition self-start"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-6">User ID</th>
                  <th className="py-3.5 px-6">Nama Pengguna</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Tanggal Bergabung</th>
                  <th className="py-3.5 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-bold text-slate-800 text-sm">{u.username}</td>
                    <td className="py-4 px-6 text-slate-700">{u.name}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          u.role === "admin"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          u.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {u.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {new Date(u.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setModalResetOpen(true);
                        }}
                        title="Reset Password"
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 text-xs font-medium"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Reset Pass</span>
                      </button>

                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          title={u.is_active ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                          className={`p-1.5 rounded-lg transition inline-flex items-center gap-1 text-xs font-medium ${
                            u.is_active
                              ? "text-rose-600 hover:bg-rose-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          <span>{u.is_active ? "Nonaktifkan" : "Aktifkan"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah User */}
      <Modal
        isOpen={modalCreateOpen}
        onClose={() => setModalCreateOpen(false)}
        title="Tambah Pengguna Baru"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              User ID (Username)
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: staf_keuangan"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Ahmad Fauzi"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password Awal
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Minimal 6 karakter"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Role Pengguna
              </label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition bg-white"
              >
                <option value="user">User (Staf Biasa)</option>
                <option value="admin">Admin (Akses Penuh)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalCreateOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              {submitting ? "Menyimpan..." : "Buat Akun"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Reset Password */}
      <Modal
        isOpen={modalResetOpen}
        onClose={() => setModalResetOpen(false)}
        title={`Reset Password: ${selectedUser?.username}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-slate-500">
            Masukkan password baru untuk akun pengguna ini.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Minimal 6 karakter"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalResetOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              {submitting ? "Memproses..." : "Set Password Baru"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

