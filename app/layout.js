'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wrench,
  MessageSquare,
  AlertTriangle,
  ShieldCheck,
  Megaphone,
  Palette,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import './globals.css';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, real: true },
  { href: '/service-orders', label: 'Service Orders', icon: Wrench, real: true, comingSub: ['Schedule View — Coming Soon'] },
  { href: '/conversations', label: 'Conversations', icon: MessageSquare, real: false },
  { href: '/complaints', label: 'Complaints', icon: AlertTriangle, real: true },
  { href: '/warranty', label: 'Warranty', icon: ShieldCheck, real: true },
  { href: '/marketing', label: 'Marketing', icon: Megaphone, real: true },
  { href: '/brand', label: 'Brand Kit', icon: Palette, real: true },
  { href: '/products', label: 'Products', icon: Package, real: true },
  { href: '/settings', label: 'Settings', icon: Settings, real: false, comingSub: ['Warranty Rules — Coming Soon', 'WhatsApp Integration — Coming Soon', 'Team Members — Coming Soon'] },
];

export default function RootLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: '#f5f6f7', color: '#1c1e21' }}>
        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-md"
          style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1' }}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 md:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 transition-all duration-200 flex flex-col
            ${collapsed ? 'w-16' : 'w-64'}
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          style={{
            backgroundColor: '#ffffff',
            borderRight: '1px solid #dadde1',
          }}
        >
          {/* Brand */}
          <div
            className={`flex items-center h-14 px-4 ${collapsed ? 'justify-center' : ''}`}
            style={{ borderBottom: '1px solid #dadde1' }}
          >
            {!collapsed && (
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: '#1877f2' }}
                >
                  <span className="text-white text-[13px] font-bold">F</span>
                </div>
                <span className="text-[14px] font-semibold tracking-tight" style={{ color: '#1c1e21' }}>
                  Fanz AI Ops
                </span>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex ml-auto p-1 rounded transition-colors"
              style={{ color: '#65676b' }}
              aria-label="Toggle sidebar"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors
                      ${collapsed ? 'justify-center' : ''}`}
                    style={
                      isActive
                        ? { backgroundColor: '#e7f3ff', color: '#1877f2', fontWeight: 600 }
                        : { color: '#1c1e21', fontWeight: 500 }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = '#f2f3f5';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      style={{ color: isActive ? '#1877f2' : '#65676b', flexShrink: 0 }}
                    />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && !item.real && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: '#f2f3f5', color: '#65676b' }}
                      >
                        Soon
                      </span>
                    )}
                  </Link>
                  {!collapsed && item.comingSub && pathname === item.href && (
                    <div className="ml-9 mt-0.5 mb-1 space-y-0.5">
                      {item.comingSub.map((sub, i) => (
                        <div
                          key={i}
                          className="text-[11px] py-1 px-2 italic"
                          style={{ color: '#8a8d91' }}
                        >
                          {sub}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div
            className={`px-4 py-3 text-[11px] ${collapsed ? 'text-center' : ''}`}
            style={{ borderTop: '1px solid #dadde1', color: '#8a8d91' }}
          >
            {!collapsed ? <span>Fanz Sdn Bhd · AI System</span> : <span>F</span>}
          </div>
        </aside>

        {/* Main content */}
        <main className={`transition-all duration-200 ${collapsed ? 'md:ml-16' : 'md:ml-64'} min-h-screen`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 pt-16 md:pt-10">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
