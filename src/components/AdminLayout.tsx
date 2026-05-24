import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Menu, X, LogOut, LayoutDashboard, Users, 
  MapPin, Fingerprint, Calendar, FileText, RefreshCw, Clock, Shield
} from 'lucide-react';

const LOGO_URL = "https://www.wekeyarplus.in/public/images/logo.png";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function AdminLayout({ children, title, subtitle, onRefresh, loading }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Fingerprint, label: 'Attendance', path: '/attendance' },
    { icon: Users, label: 'Employees', path: '/employees' },
    { icon: MapPin, label: 'Locations', path: '/locations' },
    { icon: Calendar, label: 'Leave Approval', path: '/leaves' },
    { icon: FileText, label: 'Reports', path: '/reports' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDayLabel = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Panel for Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full justify-between p-5">
          {/* Top Branding Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-center py-2">
              <img src={LOGO_URL} alt="Logo" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
            </div>

            {/* Main Navigation Menu */}
            <div className="pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Main Menu</p>
              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '');
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        navigate(item.path);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-[#006B99]/10 text-[#006B99] font-bold shadow-xs'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-[#006B99]'
                      }`}
                    >
                      <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Bottom Area: Logout & Digital clock */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold text-[#E73124] hover:bg-red-50 transition-all rounded-xl cursor-pointer"
            >
              <LogOut size={18} strokeWidth={2.5} />
              Logout
            </button>

            {/* Clock Widget exactly like images */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white shadow-xs border border-slate-100 text-[#006B99] rounded-xl flex items-center justify-center">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800 tracking-tight">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </p>
                <p className="text-[10px] font-bold text-slate-400">
                  {getDayLabel(currentTime)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for Mobile drawer */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-20 flex justify-between items-center h-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-500 mr-1"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:block">
              <h2 className="text-xl font-extrabold text-[#004D6E] tracking-tight">{title}</h2>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5 font-medium">{subtitle}</p>}
            </div>
          </div>

          {/* Right side - Refresh button */}
          <div className="flex items-center gap-4">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2.5 text-slate-400 hover:text-[#006B99] hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                title="Refresh data"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin text-[#006B99]' : ''} />
              </button>
            )}

            <div className="h-10 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-extrabold text-slate-700 tracking-tight">{user?.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user?.role}</p>
              </div>
              <div className="w-10 h-10 bg-[#006B99]/10 rounded-2xl flex items-center justify-center text-[#006B99] font-black tracking-tighter shadow-sm border border-[#006B99]/10">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile title bar - visible only on mobile */}
        <div className="md:hidden px-6 pt-4 pb-2 bg-white border-b border-slate-100">
          <h2 className="text-lg font-extrabold text-[#004D6E] tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 font-medium">{subtitle}</p>}
        </div>

        {/* Child Views */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}