import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  CircleDollarSign,
  Coins,
  Cpu,
  DollarSign,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Settings as SettingsIcon,
  Table2,
  Tags,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { expensesApi } from "../api/client";

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [trxDropdownOpen, setTrxDropdownOpen] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const dropdownRef = useRef(null);
  const trxDropdownRef = useRef(null);

  const fetchDraftCount = async () => {
    try {
      const drafts = await expensesApi.getDrafts();
      setDraftCount(drafts?.length || 0);
    } catch {
      // Abaikan jika belum login
    }
  };

  useEffect(() => {
    fetchDraftCount();
    const interval = setInterval(fetchDraftCount, 30000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAdminDropdownOpen(false);
      }
      if (trxDropdownRef.current && !trxDropdownRef.current.contains(event.target)) {
        setTrxDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Tutup menu saat rute berganti
  useEffect(() => {
    setAdminDropdownOpen(false);
    setTrxDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;
  const isTrxActive = location.pathname === "/transactions" || location.pathname === "/transactions-excel";
  const isAdminActive = location.pathname.startsWith("/admin");

  const adminMenuItems = [
    { to: "/admin/users", label: "Kelola Pengguna", icon: Users, color: "text-slate-800 bg-slate-100" },
    { to: "/admin/currencies", label: "Mata Uang", icon: Coins, color: "text-amber-600 bg-amber-50" },
    { to: "/admin/ai-models", label: "Model AI Vision", icon: Cpu, color: "text-sky-600 bg-sky-50" },
    { to: "/admin/settings", label: "Pengaturan Sistem", icon: SettingsIcon, color: "text-slate-600 bg-slate-100" },
  ];

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all">
      <div className={`${isTrxActive && location.pathname === "/transactions-excel" ? "max-w-none px-3 sm:px-5 lg:px-6" : "max-w-7xl px-4 sm:px-6 lg:px-8"} mx-auto transition-all`}>
        <div className="flex justify-between items-center h-16">
          {/* Sisi Kiri: Logo & Navigasi Utama */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 font-bold text-base text-slate-900 tracking-tight group">
              <div className="p-2 bg-slate-900 group-hover:bg-emerald-600 rounded-xl text-white shadow-xs ring-1 ring-slate-800/10 transition-colors">
                <CircleDollarSign className="w-4 h-4 text-emerald-400 group-hover:text-white transition-colors" />
              </div>
              <span className="font-semibold text-slate-900">
                Simple<span className="text-emerald-600 font-bold">Cashflow</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isActive("/")
                    ? "bg-slate-100 text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              {/* Transaksi Dropdown Menu */}
              <div className="relative" ref={trxDropdownRef}>
                <button
                  onClick={() => setTrxDropdownOpen(!trxDropdownOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    isTrxActive || trxDropdownOpen
                      ? "bg-slate-100 text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Receipt className="w-4 h-4 text-slate-500" />
                  <span>Transaksi</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      trxDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {trxDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/10 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="space-y-0.5">
                      <Link
                        to="/transactions"
                        onClick={() => setTrxDropdownOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                          isActive("/transactions")
                            ? "bg-slate-100 text-slate-900 font-semibold"
                            : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        <Receipt className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Transaksi</span>
                      </Link>
                      <Link
                        to="/transactions-excel"
                        onClick={() => setTrxDropdownOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                          isActive("/transactions-excel")
                            ? "bg-slate-100 text-slate-900 font-semibold"
                            : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        <Table2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Transaksi (Excel)</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <Link
                to="/drafts"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isActive("/drafts")
                    ? "bg-slate-100 text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Draft Struk</span>
                {draftCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-2xs font-bold bg-amber-500 text-white animate-pulse">
                    {draftCount}
                  </span>
                )}
              </Link>

              <Link
                to="/categories"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isActive("/categories")
                    ? "bg-slate-100 text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Tags className="w-4 h-4" />
                <span>Kategori</span>
              </Link>

              {/* Admin Dropdown Menu */}
              {isAdmin && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      isAdminActive || adminDropdownOpen
                        ? "bg-slate-100 text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <SettingsIcon className="w-4 h-4 text-slate-500" />
                    <span>Kelola Sistem</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${adminDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {adminDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-52 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/10 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="space-y-0.5">
                        {adminMenuItems.map((item) => {
                          const Icon = item.icon;
                          const isCurrent = isActive(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                                isCurrent
                                  ? "bg-slate-100 text-slate-900 font-semibold"
                                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg ${item.color} shrink-0`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Action Buttons & Profil */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Quick Action Buttons */}
            <Link
              to="/expenses/add"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50/90 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-rose-600" />
              <span>Pengeluaran</span>
            </Link>

            <Link
              to="/incomes/add"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pemasukan</span>
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 pl-1">
              <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl">
                <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-2xs uppercase">
                  {(user?.name || user?.username || "U")[0]}
                </div>
                <span className="font-semibold text-slate-800 max-w-[110px] truncate">{user?.name || user?.username}</span>
                <span className="px-1.5 py-0.2 rounded-md text-2xs font-semibold uppercase bg-white text-slate-600 border border-slate-200">
                  {user?.role}
                </span>
              </div>

              <Link
                to="/change-password"
                title="Ganti Password"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <KeyRound className="w-4 h-4" />
              </Link>

              <button
                onClick={handleLogout}
                title="Keluar"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile hamburger button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2">
          {/* Quick Actions Mobile */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/expenses/add"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-1.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold text-center"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Pengeluaran</span>
            </Link>
            <Link
              to="/incomes/add"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold text-center"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Pemasukan</span>
            </Link>
          </div>

          {/* Main Links Mobile */}
          <div className="space-y-1">
            <p className="px-2 text-2xs font-bold uppercase tracking-wider text-slate-400">
              Navigasi Kas
            </p>
            {[
              { to: "/", label: "Dashboard", icon: LayoutDashboard },
              { to: "/transactions", label: "Transaksi", icon: Receipt },
              { to: "/transactions-excel", label: "Transaksi (Excel)", icon: Table2 },
              { to: "/drafts", label: "Draft Struk", icon: FileText, badge: draftCount },
              { to: "/categories", label: "Kelola Kategori", icon: Tags },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                    isActive(link.to) ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span>{link.label}</span>
                  </div>
                  {link.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-2xs font-bold bg-amber-500 text-white">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Admin Links Mobile */}
          {isAdmin && (
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <p className="px-2 text-2xs font-bold uppercase tracking-wider text-slate-400">
                Administrator
              </p>
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${
                      isActive(item.to) ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* User Profile Mobile */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
              <p className="text-2xs text-slate-400">@{user?.username} &bull; {user?.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/change-password"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg text-xs"
                title="Ganti Password"
              >
                <KeyRound className="w-4 h-4" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
