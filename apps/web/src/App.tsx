import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Pill } from 'lucide-react';
import { can, type Permission } from '@medistock/core';
import { StoreProvider, useStore } from './lib/store';
import { ToastProvider } from './components/Toast';
import { AppShell } from './layout/AppShell';
import SignIn from './pages/SignIn';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import MedicineDetail from './pages/MedicineDetail';
import Receive from './pages/Receive';
import Dispense from './pages/Dispense';
import ExpiryCenter from './pages/ExpiryCenter';
import Alerts from './pages/Alerts';
import { SupplierDetail, SupplierList } from './pages/Suppliers';
import { PurchaseOrderEditor, PurchaseOrderList } from './pages/PurchaseOrders';
import Settings from './pages/Settings';

const ReportPicker = lazy(() => import('./pages/Reports').then((m) => ({ default: m.ReportPicker })));
const ReportView = lazy(() => import('./pages/Reports').then((m) => ({ default: m.ReportView })));

function Splash({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper text-ink-2">
      <span className="flex h-11 w-11 animate-pulse items-center justify-center rounded-[12px] bg-brand text-on-brand"><Pill size={22} /></span>
      <p>{message ?? 'Loading MediStock…'}</p>
    </div>
  );
}

function Guard({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { user } = useStore();
  return can(user?.role, perm) ? <>{children}</> : <Navigate to="/" replace />;
}

function Root() {
  const { user, ds, loading, error } = useStore();
  if (loading) return <Splash />;
  if (!user) return <SignIn />;
  if (error && !ds) return <Splash message={`Could not load data: ${error}`} />;
  if (!ds) return <Splash />;
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/:id" element={<MedicineDetail />} />
          <Route path="receive" element={<Guard perm="receive"><Receive /></Guard>} />
          <Route path="dispense" element={<Guard perm="dispense"><Dispense /></Guard>} />
          <Route path="expiry" element={<ExpiryCenter />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="suppliers" element={<SupplierList />} />
          <Route path="suppliers/:id" element={<SupplierDetail />} />
          <Route path="orders" element={<Guard perm="orders"><PurchaseOrderList /></Guard>} />
          <Route path="orders/:id" element={<Guard perm="orders"><PurchaseOrderEditor /></Guard>} />
          <Route path="reports" element={<Guard perm="reports"><ReportPicker /></Guard>} />
          <Route path="reports/:kind" element={<Guard perm="reports"><ReportView /></Guard>} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <StoreProvider>
          <Root />
        </StoreProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
