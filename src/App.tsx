import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Timesheet from './pages/Timesheet';
import Attendance from './pages/Attendance';
import Compliance from './pages/Compliance';
import Payroll from './pages/Payroll';
import Expenses from './pages/Expenses';
import Worksites from './pages/Worksites';
import SyncMonitor from './pages/SyncMonitor';
import RulesPage from './pages/Rules';

// Lazy: keeps the heavy Excel parser out of the initial bundle.
const ImportCenter = lazy(() => import('./pages/ImportCenter'));

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/timesheet" element={<Timesheet />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/worksites" element={<Worksites />} />
            <Route path="/sync" element={<SyncMonitor />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/import" element={
              <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-10 h-10 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin" /></div>}>
                <ImportCenter />
              </Suspense>
            } />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
