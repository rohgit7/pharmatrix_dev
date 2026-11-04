import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppShell: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();
  const isWorkspace =
    location.pathname.startsWith('/route-optimization') ||
    location.pathname.startsWith('/routes');

  return (
    <div className="min-h-screen bg-ivory-50 text-charcoal flex">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Layout */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <Topbar />
        <main
          className={
            isWorkspace
              ? 'flex-1 flex flex-col min-w-0 overflow-hidden h-[calc(100vh-4rem)] p-3 sm:p-4'
              : 'flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto'
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
