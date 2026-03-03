import { Suspense, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';

function ContentSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="skeleton h-6 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-28 w-full" />
      </div>
    </div>
  );
}

export default function Layout({ authLoading = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] bg-[#0a0a0f] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <span className="material-icons-outlined text-gray-400">menu</span>
          </button>

          <NavLink to="/" className="flex items-center gap-2">
            <span className="material-icons-outlined text-violet-400">auto_awesome</span>
            <span className="font-semibold text-white">Nevy AI</span>
          </NavLink>

          <div className="flex-1" />

          <NavLink
            to="/create"
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <span className="material-icons-outlined text-sm">add</span>
            Create
          </NavLink>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {authLoading ? (
            <ContentSkeleton />
          ) : (
            <Suspense fallback={<ContentSkeleton />}>
              <Outlet />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}
