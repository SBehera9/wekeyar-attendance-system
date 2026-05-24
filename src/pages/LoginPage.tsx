import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';

const LOGO_URL = "https://www.wekeyarplus.in/public/images/logo.png";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(employeeId, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid Employee ID or Password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Header section with brand colors */}
        <div className="bg-[#004D6E] text-white p-8 text-center relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-[#006B99] opacity-20 rounded-full translate-x-12 -translate-y-12" />
          <div className="absolute left-0 bottom-0 w-24 h-24 bg-[#0088C2] opacity-10 rounded-full -translate-x-8 translate-y-8" />
          
          <div className="relative inline-flex items-center justify-center mb-4">
            <img src={LOGO_URL} alt="Logo" className="max-h-14 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          <p className="text-white/85 text-xs font-bold uppercase tracking-widest mt-2 animate-pulse">Attendance Management</p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Employee ID</label>
            <div className="relative rounded-2xl">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. staff001"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-[#006B99] focus:ring-4 focus:ring-[#006B99]/5 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Password</label>
            <div className="relative rounded-2xl">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-[#006B99] focus:ring-4 focus:ring-[#006B99]/5 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[#006B99] cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-[#E73124] text-xs font-bold flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-[#006B99] hover:bg-[#004D6E] active:scale-98 text-white rounded-2xl font-extrabold text-sm tracking-wide shadow-md shadow-[#006B99]/15 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>

          {/* Note: Managed securely by the platform authorization matrix */}
        </form>
      </div>
    </div>
  );
}
