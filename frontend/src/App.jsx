import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import AddExpense from "./pages/AddExpense";
import Drafts from "./pages/Drafts";
import AddIncome from "./pages/AddIncome";
import ManageUsers from "./pages/ManageUsers";
import Currencies from "./pages/Currencies";
import AIModels from "./pages/AIModels";
import Settings from "./pages/Settings";
import ChangePassword from "./pages/ChangePassword";
import ManageCategories from "./pages/ManageCategories";

const TransactionsExcel = React.lazy(() => import("./pages/TransactionsExcel"));

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-900/20 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="transactions-excel" element={<TransactionsExcel />} />
              <Route path="expenses/add" element={<AddExpense />} />
              <Route path="drafts" element={<Drafts />} />
              <Route path="incomes/add" element={<AddIncome />} />
              <Route path="categories" element={<ManageCategories />} />
              <Route path="change-password" element={<ChangePassword />} />

              {/* Admin Only */}
              <Route
                path="admin/users"
                element={
                  <ProtectedRoute adminOnly>
                    <ManageUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/currencies"
                element={
                  <ProtectedRoute adminOnly>
                    <Currencies />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/ai-models"
                element={
                  <ProtectedRoute adminOnly>
                    <AIModels />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/settings"
                element={
                  <ProtectedRoute adminOnly>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

