import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Location, AttendanceRecord, LeaveRequest } from '../types';
import { api } from '../lib/api';
import { 
  Menu, X, Calendar, LogOut, Clock, CheckCircle, 
  MapPin, Fingerprint, RefreshCw, Smartphone, 
  Briefcase, Building2, User as UserIcon, AlertCircle, Play, Power, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDistance, getTodayIST, formatTime, formatDate, calculateBreakHours, getStatusColor, getStatusLabel } from '../lib/utils';

const LOGO_URL = "https://www.wekeyarplus.in/public/images/logo.png";

export default function StaffPortal() {
  const { user, logout } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'leaves' | 'profile'>('home');
  const [showApplyLeave, setShowApplyLeave] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDate, setLeaveDate] = useState(getTodayIST());
  const [leaveType, setLeaveType] = useState<'Casual Leave' | 'Medical Leave' | 'Unpaid Leave'>('Casual Leave');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Filter states for range logs and leave requests
  const [logStartDate, setLogStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [logEndDate, setLogEndDate] = useState(getTodayIST());

  const [leaveStartDate, setLeaveStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().split('T')[0];
  });
  const [leaveEndDate, setLeaveEndDate] = useState(getTodayIST());

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [l, a, lv] = await Promise.all([
        api.getLocations(), 
        api.getAttendance(), 
        api.getLeaves()
      ]);
      setLocations(l);
      setAttendance(a.filter(r => r.employeeId === user?.employeeId).reverse());
      setLeaves(lv.filter(r => r.employeeId === user?.employeeId).reverse());
    } catch (err) {
      console.error('Failed to load portal data:', err);
    } finally {
      if (!isSilent) setRefreshing(false);
    }
  }, [user]);

  // Handle periodic data reloading & watch GPS position
  useEffect(() => {
    loadData();
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true }
      );
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
    };
  }, [loadData]);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => setTimeRemaining(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining]);

  const today = getTodayIST();
  const todayRecord = attendance.find(r => r.date === today);
  const staffLoc = locations.find(l => l.id === user?.locationId);
  const currentDistance = (coords && staffLoc) ? getDistance(coords.latitude, coords.longitude, staffLoc.latitude, staffLoc.longitude) : null;
  const isInside = currentDistance !== null && staffLoc && currentDistance <= staffLoc.radius;

  // Real-time leave checking for today
  const todayLeave = leaves.find(l => l.date === today);
  const isLeaveApprovedToday = !!(todayLeave && todayLeave.status === 'Leave');
  const isLeavePendingToday = !!(todayLeave && todayLeave.status === 'Pending Leave');
  const isLeaveRejectedToday = !!(todayLeave && todayLeave.status === 'Rejected');
  const isTodayPunchedIn = !!(todayRecord && todayRecord.checkIn);
  const isLocationDeactivated = !!(staffLoc && (staffLoc.status === 'deactivated' || staffLoc.status === 'inactive'));

  const handleRefreshGPS = () => {
    if (!navigator.geolocation) {
      alert("GPS Geolocation is not supported by your device");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGpsLoading(false);
        setMessage("GPS Signal Refreshed!");
        setStatus("success");
        setTimeout(() => setStatus("idle"), 2000);
      },
      (err) => {
        setGpsLoading(false);
        setMessage(err.message || "Failed to locate GPS");
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2500);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePunch = async (type: 'checkIn' | 'breakIn' | 'breakOut' | 'checkOut') => {
    if (isLocationDeactivated) {
      setMessage('Your assigned work site/branch has been deactivated');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    if (isLeaveApprovedToday) {
      setMessage('Attendance system is disabled for approved leave dates');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    if (isLeavePendingToday) {
      setMessage('Attendance options are disabled until Admin/HR takes action');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    if (!coords) {
      setMessage('GPS signal not found');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    if (!isInside) {
      setMessage(`You are ${Math.round(currentDistance || 0)} meters away from office boundary`);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    
    // Validate the sequential 1-minute action wait limit
    if (!punchAction.allow && punchAction.waitSec > 0) {
      setMessage(`Please wait ${punchAction.waitSec} seconds for next sequential punch`);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
      return;
    }

    setStatus('loading');
    try {
      await api.punch({
        employeeId: user!.employeeId,
        type,
        locationId: staffLoc!.id,
        timestamp: new Date().toISOString(),
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      await loadData();
      setStatus('success');
      const messages = { 
        checkIn: 'Punched In Successfully', 
        breakIn: 'Break Started', 
        breakOut: 'Break Ended', 
        checkOut: 'Punched Out Successfully' 
      };
      setMessage(messages[type]);
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Operation failed');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if they have already punched in for that date
    const punchedInForSelectedDate = attendance.some(r => r.date === leaveDate && r.checkIn);
    if (punchedInForSelectedDate) {
      setStatus('error');
      setMessage('Cannot apply: Already punched in for this date');
      setTimeout(() => setStatus('idle'), 3000);
      alert('You have already punched in for this selected date. Leave application is disabled.');
      return;
    }

    // Check existing leaves
    const existingLeave = leaves.find(l => l.date === leaveDate);
    if (existingLeave) {
      if (existingLeave.status === 'Leave') {
        setStatus('error');
        setMessage('Leave already approved for this date');
        setTimeout(() => setStatus('idle'), 3000);
        alert('This selected date has already been approved for leave.');
        return;
      }
      if (existingLeave.status === 'Pending Leave') {
        setStatus('error');
        setMessage('Application already pending for this date');
        setTimeout(() => setStatus('idle'), 3000);
        alert('You already have a pending leave application for this selected date.');
        return;
      }
      // If status is 'Rejected', they can apply again! So we do NOT block.
    }

    setStatus('loading');
    try {
      await api.applyLeave({
        employeeId: user!.employeeId,
        date: leaveDate,
        reason: leaveReason,
        type: leaveType
      });
      setShowApplyLeave(false);
      setLeaveReason('');
      setLeaveDate(getTodayIST());
      await loadData();
      setMessage('Leave request submitted!');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to submit request');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleQuickRequest = async (type: 'Leave' | 'Absent' | 'Week Off') => {
    setStatus('loading');
    try {
      await api.applyLeave({
        employeeId: user!.employeeId,
        date: getTodayIST(),
        reason: `Quick mark today as ${type}`,
        type: type
      });
      await loadData();
      setMessage(`Submitted mark for ${type}!`);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to request');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  const handleLogout = async () => {
    if (!passwordConfirm) {
      setLogoutError('Please enter your password');
      return;
    }
    setStatus('loading');
    try {
      const isValid = await api.verifyPassword(user!.employeeId, passwordConfirm);
      if (isValid) {
        logout();
      } else {
        setLogoutError('Incorrect password');
      }
    } catch (err) {
      setLogoutError('Verification failed');
    } finally {
      setStatus('idle');
    }
  };

  // Determine current sequential punch action configuration under 1-minute wait rules
  const getNextActionConfig = () => {
    if (!todayRecord) {
      return { 
        type: 'checkIn' as const, 
        label: 'PUNCH IN', 
        color: 'bg-[#006B99]',
        allow: true,
        waitSec: 0
      };
    }
    if (todayRecord.checkOut) {
      return { 
        type: 'done' as const, 
        label: 'SHIFT DONE', 
        color: 'bg-slate-400',
        allow: false,
        waitSec: 0
      };
    }
    
    // 1. If checkIn exists but no breakIn
    if (todayRecord.checkIn && !todayRecord.breakIn) {
      const diffMs = currentTime.getTime() - new Date(todayRecord.checkIn).getTime();
      const waitMs = 60000 - diffMs;
      if (waitMs > 0) {
        return {
          type: 'breakIn' as const,
          label: 'PUNCH BREAK IN',
          color: 'bg-orange-400',
          allow: false,
          waitSec: Math.ceil(waitMs / 1000)
        };
      }
      return {
        type: 'breakIn' as const,
        label: 'PUNCH BREAK IN',
        color: 'bg-orange-500',
        allow: true,
        waitSec: 0
      };
    }

    // 2. If breakIn exists but no breakOut
    if (todayRecord.breakIn && !todayRecord.breakOut) {
      const diffMs = currentTime.getTime() - new Date(todayRecord.breakIn).getTime();
      const waitMs = 60000 - diffMs;
      if (waitMs > 0) {
        return {
          type: 'breakOut' as const,
          label: 'PUNCH BREAK OUT',
          color: 'bg-amber-400',
          allow: false,
          waitSec: Math.ceil(waitMs / 1000)
        };
      }
      return {
        type: 'breakOut' as const,
        label: 'PUNCH BREAK OUT',
        color: 'bg-orange-500',
        allow: true,
        waitSec: 0
      };
    }

    // 3. If breakOut exists but no checkOut
    if (todayRecord.breakOut && !todayRecord.checkOut) {
      const diffMs = currentTime.getTime() - new Date(todayRecord.breakOut).getTime();
      const waitMs = 60000 - diffMs;
      if (waitMs > 0) {
        return {
          type: 'checkOut' as const,
          label: 'PUNCH OUT',
          color: 'bg-rose-450 bg-rose-400',
          allow: false,
          waitSec: Math.ceil(waitMs / 1000)
        };
      }
      return {
        type: 'checkOut' as const,
        label: 'PUNCH OUT',
        color: 'bg-[#E73124]',
        allow: true,
        waitSec: 0
      };
    }

    // Default fallback to checkOut if checked in
    return { 
      type: 'checkOut' as const, 
      label: 'PUNCH OUT', 
      color: 'bg-[#E73124]',
      allow: true,
      waitSec: 0
    };
  };

  const punchAction = getNextActionConfig();
  const isCheckedInToday = !!(todayRecord && todayRecord.checkIn && !todayRecord.checkOut);

  const getWeekDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const formatHoursValue = (val?: number) => {
    if (val === undefined || val === null) return '0.00';
    return val.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-slate-900 md:py-8 flex items-center justify-center font-sans">
      
      {/* Handheld Device Bezel Mock for Desktop */}
      <div className="w-full max-w-[430px] bg-slate-950 md:rounded-[48px] md:shadow-2xl md:border-[10px] border-slate-800 overflow-hidden relative h-screen md:h-[880px] flex flex-col justify-between">
        
        {/* Notch / Speaker block for Desktop layout */}
        <div className="hidden md:block absolute left-1/2 top-2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-900 rounded-full" />
        </div>

        {/* Main Phone Body Section */}
        <div className="bg-white flex-1 flex flex-col relative text-slate-800 pb-16 h-full overflow-hidden">
          
          {/* Header Part from Image */}
          <header className="px-5 pt-8 pb-4 border-b border-slate-100 flex justify-between items-start gap-3">
            {/* Left side Logo and stacked user details */}
            <div className="flex flex-col items-start gap-1 min-w-0 flex-1 text-left">
              <img src={LOGO_URL} alt="Logo" className="h-10 w-auto object-contain flex-shrink-0" referrerPolicy="no-referrer" />
              
              {/* If activeTab is 'home', show the name, location and active indicator. Other pages show only the logo */}
              {activeTab === 'home' && (
                <div className="min-w-0 flex flex-col items-start space-y-0.5 mt-1">
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                    {user?.name || "EMPLOYEE NAME"}
                  </h2>
                  <div className="flex items-center gap-1 text-[9px] text-slate-500 font-extrabold uppercase tracking-wider truncate">
                    <MapPin size={10} className="text-[#006B99] flex-shrink-0" />
                    <span className="truncate">{staffLoc?.name || "UNASSIGNED BRANCH"}</span>
                  </div>
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-100">
                    ACTIVE
                  </span>
                </div>
              )}
            </div>

            {/* Right side Cycle refresh button */}
            <button 
              onClick={() => loadData()}
              disabled={refreshing}
              className={`flex-shrink-0 w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#006B99] hover:bg-slate-100 cursor-pointer ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={16} />
            </button>
          </header>

          {/* Action and status updates notices overlay - POP-UP TYPE AT THE TOP */}
          <AnimatePresence>
            {status !== 'idle' && message && (
              <motion.div 
                initial={{ opacity: 0, y: -50, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className={`absolute top-4 left-4 right-4 z-[9999] p-3.5 rounded-2xl text-xs font-black text-slate-800 flex items-center gap-3 shadow-2xl border ${
                  status === 'success' ? 'bg-white border-emerald-200 text-slate-800' :
                  status === 'error' ? 'bg-white border-rose-200 text-slate-800' :
                  'bg-white border-sky-100 text-slate-800'
                }`}
              >
                {/* Visual state indicator icon */}
                <div className={`p-1.5 rounded-xl flex-shrink-0 ${
                  status === 'success' ? 'bg-emerald-55 bg-emerald-50 text-emerald-600' :
                  status === 'error' ? 'bg-rose-50 text-[#E73124]' :
                  'bg-sky-55 bg-sky-50 text-[#006B99]'
                }`}>
                  {status === 'success' && <CheckCircle size={16} />}
                  {status === 'error' && <AlertCircle size={16} />}
                  {status === 'loading' && <RefreshCw size={16} className="animate-spin" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                    {status === 'success' ? 'SUCCESS ALERT' : status === 'error' ? 'LOCKED NOTICE' : 'KPI SYNCING...'}
                  </p>
                  <p className="text-xs font-extrabold text-slate-800 uppercase tracking-tight truncate leading-normal">
                    {message}
                  </p>
                </div>

                <button 
                  onClick={() => setStatus('idle')} 
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer flex-shrink-0"
                >
                  <X size={14} className="stroke-[2.5]" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Panel Content depending on Menu Selection */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            
            {activeTab === 'home' && (
              <>
                {/* Time, Date, and TODAY INDEX Card (Image top card style) */}
                <div className="grid grid-cols-12 gap-3.5">
                  
                  {/* Digital Clock Section */}
                  <div className="col-span-7 bg-slate-50 border border-slate-100 rounded-3xl p-4 flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Time</p>
                    <div className="flex items-baseline gap-1 mt-1 text-[#004D6E]">
                      <span className="text-2xl font-black tracking-tighter">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                      <span className="text-xs font-bold uppercase text-[#006B99]">
                        {currentTime.toLocaleTimeString([], { hour12: true }).slice(-2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        :{currentTime.getSeconds().toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">
                      {getWeekDayName(currentTime)}
                    </p>
                  </div>

                  {/* Today Index Status */}
                  <div className="col-span-5 bg-slate-50 border border-slate-100 rounded-3xl p-4 flex flex-col justify-center items-center text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Today Index</p>
                    <p className="text-lg font-black tracking-tight text-[#006B99] mt-2.5">
                      {!todayRecord ? 'PENDING' :
                       todayRecord.status === 'Leave' ? 'ON LEAVE' :
                       todayRecord.status === 'Week Off' ? 'WEEK OFF' :
                       todayRecord.checkOut ? 'COMPLETED' : 'WORKING'}
                    </p>
                  </div>
                </div>

                {/* Notification for Rejected Leave Requests */}
                {leaves.filter(l => l.status === 'Rejected').slice(0, 1).map((rej) => (
                  <div key={rej.id} className="bg-rose-50 border border-rose-200 rounded-3xl p-4 text-xs shadow-xs space-y-1 text-left relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-[#E73124] uppercase tracking-wider flex items-center gap-1.55">
                        <AlertCircle size={12} />
                        APPLICATION REJECTED
                      </p>
                      <span className="text-[8px] font-mono text-slate-400 uppercase font-bold">
                        {rej.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-700 font-semibold leading-normal text-[11px]">
                      Your request for <b className="text-[#E73124]">{formatDate(rej.date)}</b> was rejected (Reason: "{rej.reason || 'None specified'}"). Options are re-enabled: you can punch in or apply again.
                    </p>
                  </div>
                ))}

                {/* Geofence boundary card (Compact Design) */}
                <div className="rounded-2xl border p-3 bg-white shadow-xs">
                  <div className="flex justify-between items-center gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#004D6E]">Boundary Check</span>
                      <button
                        onClick={handleRefreshGPS}
                        disabled={gpsLoading}
                        className={`p-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#006B99] rounded-md flex items-center justify-center cursor-pointer transition-all ${gpsLoading ? 'animate-spin' : ''}`}
                        title="Recheck GPS Signal"
                        type="button"
                      >
                        <RefreshCw size={10} />
                      </button>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      isInside ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-[#E73124] border border-rose-100'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isInside ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
                      {isInside ? 'INSIDE' : 'OUTSIDE'}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-bold border-t border-slate-100 pt-2 gap-2">
                    <span>GPS: <span className="font-mono text-slate-700">{coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : '---'}</span></span>
                    {staffLoc && (
                      <span>Dist: <span className="font-mono text-slate-800 font-black">{currentDistance !== null ? `${Math.round(currentDistance)}m` : '---'}</span> / {staffLoc.radius}m Max</span>
                    )}
                  </div>

                  {staffLoc && currentDistance !== null && currentDistance > staffLoc.radius && (
                    <div className="mt-1.5 text-center font-black text-[9px] text-[#E73124] bg-rose-50 border border-rose-100 rounded-xl py-1.5 px-3 leading-tight uppercase">
                      ⚠️ Limit exceeded. Set radius to {Math.ceil(currentDistance)}m in Settings.
                    </div>
                  )}

                  {staffLoc && currentDistance !== null && currentDistance <= staffLoc.radius && (
                    <div className="mt-1.5 text-center font-black text-[9px] text-[#006B99] bg-sky-550 bg-sky-50 border border-sky-100 rounded-xl py-1 px-2 leading-tight uppercase">
                      🎉 Authorized: Inside geo-boundary
                    </div>
                  )}
                </div>

                {/* Record grids with checkout status timers */}
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-2 text-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Punch In</p>
                    <p className="text-xs font-black text-slate-700 tracking-tight mt-1">
                      {todayRecord?.checkIn ? new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-- : --'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-2 text-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Break In</p>
                    <p className="text-xs font-black text-slate-700 tracking-tight mt-1">
                      {todayRecord?.breakIn ? new Date(todayRecord.breakIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-- : --'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-2 text-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Break Out</p>
                    <p className="text-xs font-black text-slate-700 tracking-tight mt-1">
                      {todayRecord?.breakOut ? new Date(todayRecord.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-- : --'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-2 text-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Punch Out</p>
                    <p className="text-xs font-black text-slate-700 tracking-tight mt-1">
                      {todayRecord?.checkOut ? new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-- : --'}
                    </p>
                  </div>
                </div>

                {/* Center Dynamic Big Punch Action Button (The "Power button" style layout) */}
                <div className="py-2 flex flex-col items-center">
                  
                  {isLeaveApprovedToday ? (
                     <div className="w-48 h-48 rounded-full border-[10px] border-emerald-250 border-emerald-200 bg-emerald-50 flex flex-col justify-center items-center p-4 text-center shadow-lg">
                       <CheckCircle size={44} className="text-emerald-600 mb-2" />
                       <span className="text-[10px] font-black tracking-wider text-emerald-600 uppercase leading-tight">LEAVE APPROVED</span>
                       <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">PUNCH LOCKED PERMANENTLY</span>
                     </div>
                  ) : isLeavePendingToday ? (
                     <div className="w-48 h-48 rounded-full border-[10px] border-amber-250 border-amber-200 bg-amber-50 flex flex-col justify-center items-center p-4 text-center shadow-lg">
                       <Clock size={44} className="text-amber-600 animate-pulse mb-2" />
                       <span className="text-[10px] font-black tracking-wider text-amber-600 uppercase leading-tight">PENDING APPROVAL</span>
                       <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">PUNCH LOCKED</span>
                     </div>
                  ) : isLocationDeactivated ? (
                     <div className="w-48 h-48 rounded-full border-[10px] border-rose-250 border-rose-200 bg-rose-50 flex flex-col justify-center items-center p-4 text-center shadow-lg">
                       <AlertCircle size={44} className="text-[#E73124] animate-pulse mb-2" />
                       <span className="text-[10px] font-black tracking-wider text-[#E73124] uppercase leading-tight text-red-650">SITE LOCKED</span>
                       <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">BRANCH DEACTIVATED</span>
                     </div>
                  ) : punchAction.type === 'done' ? (
                     <div className="w-48 h-48 rounded-full border-8 border-slate-200 bg-slate-50 flex flex-col justify-center items-center shadow-lg text-slate-400 text-center">
                       <CheckCircle size={48} className="text-emerald-500" />
                       <span className="text-xs font-black tracking-wider mt-2 text-slate-550">SHIFT DONE</span>
                       <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">THANK YOU!</span>
                     </div>
                  ) : punchAction.waitSec > 0 ? (
                    <div className="w-48 h-48 rounded-full border-[10px] border-slate-100 bg-slate-50/50 flex flex-col justify-center items-center text-center shadow-inner relative overflow-hidden">
                      <div className="w-20 h-20 rounded-3xl bg-slate-200 text-slate-400 flex items-center justify-center mb-2">
                        <Clock size={36} className="animate-spin text-slate-400" style={{ animationDuration: '4s' }} />
                      </div>
                      <span className="text-xs font-black tracking-widest text-slate-400 uppercase leading-none">
                        WAIT {punchAction.waitSec}s
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 mt-1.5 uppercase tracking-wider block leading-tight">
                        BEFORE NEXT ACTION
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePunch(punchAction.type)}
                      disabled={status === 'loading'}
                      className="w-48 h-48 rounded-full border-[10px] border-slate-100 bg-[#F8FAFC] flex flex-col justify-center items-center font-bold text-slate-700 hover:border-[#006B99]/10 shadow-lg active:scale-95 transition-all text-center cursor-pointer relative group overflow-hidden"
                    >
                      {/* Brand pulsating rings */}
                      <span className="absolute inset-0 bg-radial from-[#006B99]/5 to-transparent scale-100 group-hover:scale-110 transition-transform duration-500" />
                      <div className="w-20 h-20 rounded-3xl bg-[#006B99] text-white flex items-center justify-center shadow-md shadow-[#006B99]/30 mb-2">
                        {punchAction.type === 'checkOut' ? <Power size={36} /> : <Fingerprint size={36} />}
                      </div>
                      <span className="text-xs font-black tracking-widest text-[#004D6E] uppercase">
                        {punchAction.label}
                      </span>
                    </button>
                  )}
                </div>

                {/* Today's Working/Break Hours stats rows */}
                {todayRecord && (
                  <div className="bg-[#006B99]/5 rounded-2xl p-3 border border-[#006B99]/10 flex justify-between text-xs font-semibold text-slate-700">
                    <div className="text-center flex-1 border-r border-[#006B99]/10">
                      <p className="text-[9px] text-slate-400 uppercase font-black uppercase tracking-wider">Work</p>
                      <p className="text-sm font-extrabold text-[#004D6E] mt-0.5">{formatHoursValue(todayRecord.workHours)} hr</p>
                    </div>
                    <div className="text-center flex-1 border-r border-[#006B99]/10">
                      <p className="text-[9px] text-slate-400 uppercase font-black uppercase tracking-wider">Break</p>
                      <p className="text-sm font-extrabold text-orange-600 mt-0.5">
                        {formatHoursValue(calculateBreakHours(todayRecord.breakIn, todayRecord.breakOut))} hr
                      </p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-[9px] text-slate-400 uppercase font-black uppercase tracking-wider">Overtime</p>
                      <p className="text-sm font-extrabold text-emerald-600 mt-0.5">{formatHoursValue(todayRecord.overtime)} hr</p>
                    </div>
                  </div>
                )}

                {/* Bottom row options buttons blocks (LEAVE, ABSENT, WEEK OFF exactly as shown in screenshot) */}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-black text-center text-slate-400 uppercase tracking-widest mb-3">Quick Apply / Mark Today</p>
                  
                  {isTodayPunchedIn && (
                    <p className="text-[9px] font-black text-[#E73124] uppercase text-center mb-2 tracking-wide">
                      ⚠️ Quick Apply locked: Under general active shift / punch-in today
                    </p>
                  )}
                  {isLeavePendingToday && (
                    <p className="text-[9px] font-black text-amber-600 uppercase text-center mb-2 tracking-wide">
                      ⚠️ Quick Apply locked: Leave request is pending review
                    </p>
                  )}
                  {isLeaveApprovedToday && (
                    <p className="text-[9px] font-black text-emerald-600 uppercase text-center mb-2 tracking-wide">
                      ⚠️ Quick Apply locked: Leave approved for today
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <button
                      disabled={isTodayPunchedIn || isLeavePendingToday || isLeaveApprovedToday}
                      onClick={() => {
                        setLeaveType('Casual Leave');
                        setLeaveDate(getTodayIST());
                        setLeaveReason('');
                        setShowApplyLeave(true);
                      }}
                      className={`py-3 border-2 border-rose-100 hover:border-[#E73124]/30 active:scale-97 text-[#E73124] rounded-2xl text-[10px] font-extrabold uppercase tracking-wide bg-rose-50/20 cursor-pointer transition-all ${
                        (isTodayPunchedIn || isLeavePendingToday || isLeaveApprovedToday) ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-400 bg-slate-50' : ''
                      }`}
                    >
                      LEAVE
                    </button>
                    <button
                      disabled={isTodayPunchedIn || isLeavePendingToday || isLeaveApprovedToday}
                      onClick={() => {
                        setLeaveType('Unpaid Leave');
                        setLeaveDate(getTodayIST());
                        setLeaveReason('');
                        setShowApplyLeave(true);
                      }}
                      className={`py-3 border-2 border-orange-100 hover:border-[#E73124]/30 active:scale-97 text-orange-600 rounded-2xl text-[10px] font-extrabold uppercase tracking-wide bg-orange-50/20 cursor-pointer transition-all ${
                        (isTodayPunchedIn || isLeavePendingToday || isLeaveApprovedToday) ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-400 bg-slate-50' : ''
                      }`}
                    >
                      ABSENT
                    </button>
                    <button
                      disabled={isTodayPunchedIn || isLeavePendingToday || isLeaveApprovedToday}
                      onClick={() => {
                        setLeaveType('Week Off');
                        setLeaveDate(getTodayIST());
                        setLeaveReason('');
                        setShowApplyLeave(true);
                      }}
                      className={`py-3 border-2 border-sky-100 hover:border-[#006B99]/30 active:scale-97 text-[#006B99] rounded-2xl text-[10px] font-extrabold uppercase tracking-wide bg-sky-50/20 cursor-pointer transition-all ${
                        (isTodayPunchedIn || isLeavePendingToday || isLeaveApprovedToday) ? 'opacity-30 cursor-not-allowed border-slate-250 text-slate-400 bg-slate-50' : ''
                      }`}
                    >
                      WEEK OFF
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (() => {
              const filteredAttendance = attendance.filter(record => {
                if (!record.date) return true;
                if (logStartDate && record.date < logStartDate) return false;
                if (logEndDate && record.date > logEndDate) return false;
                return true;
              });

              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-[#004D6E] uppercase tracking-wider">Attendance Logs</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Filtered</span>
                  </div>

                  {/* Date range selection box */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Filter by Date Range</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">Start Date</label>
                        <input
                          type="date"
                          value={logStartDate}
                          onChange={(e) => setLogStartDate(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-[#006B99]"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-slate-455 uppercase tracking-widest block mb-0.5">End Date</label>
                        <input
                          type="date"
                          value={logEndDate}
                          onChange={(e) => setLogEndDate(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-[#006B99]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Attendance results list */}
                  <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                    {filteredAttendance.map((record) => {
                      const breakHrs = calculateBreakHours(record.breakIn, record.breakOut);
                      return (
                        <div key={record.id} className="bg-white border border-slate-150 rounded-2xl p-3.5 shadow-3xs space-y-2.5">
                          {/* Top Date and Status line */}
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-xs font-black text-slate-800 uppercase">{formatDate(record.date)}</span>
                              <span className="text-[10px] text-slate-400 ml-1.5 font-bold uppercase">
                                ({new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(record.date))} )
                              </span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${getStatusColor(record.status)}`}>
                              {getStatusLabel(record.status)}
                            </span>
                          </div>

                          {/* Punch Timestamps grid */}
                          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 border border-slate-100 rounded-xl text-[10px]">
                            <div>
                              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px] mb-0.5">In Time</span>
                              <span className="font-mono text-slate-700 font-black">{record.checkIn ? formatTime(record.checkIn) : '---'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px] mb-0.5">Check Out Time</span>
                              <span className="font-mono text-slate-700 font-black">{record.checkOut ? formatTime(record.checkOut) : '---'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px] mb-0.5">Break Time (In)</span>
                              <span className="font-mono text-slate-700 font-black">{record.breakIn ? formatTime(record.breakIn) : '---'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px] mb-0.5">Break Out Time</span>
                              <span className="font-mono text-slate-700 font-black">{record.breakOut ? formatTime(record.breakOut) : '---'}</span>
                            </div>
                          </div>

                          {/* Hours metrics summaries */}
                          <div className="flex justify-between text-[11px] font-bold text-slate-650 pt-2 border-t border-slate-100 bg-slate-50/50 rounded-xl p-2">
                            <div className="text-center flex-1">
                              <span className="text-[8px] text-slate-400 block font-black uppercase tracking-wider mb-0.5">Total Work Hr</span>
                              <span className="text-[#006B99] font-black">{record.workHours.toFixed(2)} hr</span>
                            </div>
                            <div className="text-center flex-1 border-x border-slate-150">
                              <span className="text-[8px] text-slate-400 block font-black uppercase tracking-wider mb-0.5">Break Hr</span>
                              <span className="text-orange-600 font-black">{breakHrs.toFixed(2)} hr</span>
                            </div>
                            <div className="text-center flex-1">
                              <span className="text-[8px] text-slate-400 block font-black uppercase tracking-wider mb-0.5">Overtime</span>
                              <span className="text-emerald-600 font-black">{record.overtime.toFixed(2)} hr</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredAttendance.length === 0 && (
                      <div className="text-center py-12 bg-slate-50 border border-slate-150 rounded-2xl text-slate-400">
                        <Clock size={36} className="mx-auto text-slate-300 mb-2 animate-pulse" />
                        <p className="text-xs font-bold uppercase tracking-wider">No punch logs matched date criteria</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Leaves Tab */}
            {activeTab === 'leaves' && (() => {
              const filteredLeaves = leaves.filter(leave => {
                if (!leave.date) return true;
                if (leaveStartDate && leave.date < leaveStartDate) return false;
                if (leaveEndDate && leave.date > leaveEndDate) return false;
                return true;
              });

              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-[#004D6E] uppercase tracking-wider">Leave Applications</h3>
                    <button
                      disabled={isCheckedInToday}
                      onClick={() => {
                        if (isCheckedInToday) {
                          alert("You are actively checked-in. Leave applications are disabled during your work shift.");
                          return;
                        }
                        setShowApplyLeave(true);
                      }}
                      className={`px-3 py-1.5 bg-[#006B99] hover:bg-[#004D6E] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wide cursor-pointer flex-shrink-0 transition-opacity ${
                        isCheckedInToday ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                    >
                      + NEW LEAVE
                    </button>
                  </div>

                  {/* Date range search filter for leaves */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Filter Leaves by Date Range</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">Start Date</label>
                        <input
                          type="date"
                          value={leaveStartDate}
                          onChange={(e) => setLeaveStartDate(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-[#006B99]"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-slate-455 uppercase tracking-widest block mb-0.5">End Date</label>
                        <input
                          type="date"
                          value={leaveEndDate}
                          onChange={(e) => setLeaveEndDate(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-[#006B99]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Filtered leaves results list */}
                  <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                    {filteredLeaves.map((leave) => (
                      <div key={leave.id} className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-xs shadow-3xs hover:bg-slate-100/50 transition-colors">
                        <div className="flex justify-between items-start mb-2 gap-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-slate-800 uppercase text-[11px]">{formatDate(leave.date)}</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase leading-tight line-clamp-3">Reason: {leave.reason}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border flex-shrink-0 ${
                            leave.status === 'Leave' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            leave.status === 'Rejected' ? 'bg-rose-50 text-[#E73124] border border-rose-105' :
                            'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            {leave.status === 'Leave' ? 'Approved' : leave.status === 'Pending Leave' ? 'Pending' : 'Rejected'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 pt-2 border-t border-slate-150 font-black tracking-wider">
                          <span>TYPE: {leave.type.toUpperCase()}</span>
                          <span>APPLIED At: {formatDate(leave.appliedAt)}</span>
                        </div>
                      </div>
                    ))}

                    {filteredLeaves.length === 0 && (
                      <div className="text-center py-12 bg-slate-50 border border-slate-150 rounded-2xl text-slate-400">
                        <Calendar size={36} className="mx-auto text-slate-300 mb-2 animate-pulse" />
                        <p className="text-xs font-bold uppercase tracking-wider">No leave applications matched criteria</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-center">
                  <div className="w-16 h-16 bg-[#006B99]/10 rounded-2xl flex items-center justify-center text-[#006B99] text-xl font-black mx-auto mb-3 border border-[#006B99]/10 shadow-xs">
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight leading-3">{user?.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wide">ID: {user?.employeeId}</p>
                  <span className="inline-block mt-3 px-3 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                    ACTIVE
                  </span>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl divide-y divide-slate-100 overflow-hidden shadow-3xs">
                  {/* Employee Unique ID */}
                  <div className="p-4 flex items-center gap-3">
                    <Smartphone size={16} className="text-[#006B99]" />
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Employee Unique ID</p>
                      <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">{user?.employeeId || "---"}</p>
                    </div>
                  </div>

                  {/* Department */}
                  <div className="p-4 flex items-center gap-3">
                    <Building2 size={16} className="text-[#006B99]" />
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Department</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5 uppercase">{user?.department || "General"}</p>
                    </div>
                  </div>

                  {/* Assigned Work Branch */}
                  <div className="p-4 flex items-center gap-3">
                    <MapPin size={16} className="text-[#006B99]" />
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Assigned Work Branch</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5 uppercase">{staffLoc?.name || "Unassigned"}</p>
                    </div>
                  </div>

                  {/* Designation */}
                  <div className="p-4 flex items-center gap-3">
                    <Briefcase size={16} className="text-[#006B99]" />
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Designation</p>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5 uppercase">{user?.role || "Staff Member"}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full py-4 bg-[#E73124] hover:bg-red-700 text-white rounded-2xl text-xs font-black tracking-widest uppercase shadow-md active:scale-97 transition-transform cursor-pointer"
                >
                  SIGN OUT FROM DEVICE
                </button>
              </div>
            )}

          </div>

          {/* Navigation Bar at Bottom for App Tab selection */}
          <nav className="absolute bottom-0 left-0 right-0 height-16 bg-white border-t border-slate-100 grid grid-cols-4 px-2 py-1.5 shadow-lg">
            {['home', 'history', 'leaves', 'profile'].map((tab) => {
              const isActive = activeTab === tab;
              const labels = { home: 'Today', history: 'Logs', leaves: 'Leave', profile: 'Me' };
              const icons = { home: Clock, history: RefreshCw, leaves: Calendar, profile: UserIcon };
              const IconComp = icons[tab as keyof typeof icons];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex flex-col items-center justify-center p-1.5 transition-all text-slate-400 hover:text-[#006B99] ${
                    isActive ? 'text-[#006B99] font-black' : 'font-medium'
                  }`}
                >
                  <IconComp size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[8px] uppercase tracking-wide mt-0.5 text-center">{labels[tab as keyof typeof labels]}</span>
                </button>
              );
            })}
          </nav>

        </div>

        {/* Apply Leave Dialog Popup */}
        <AnimatePresence>
          {showApplyLeave && (
            <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-xl">
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4">Apply for Leave</h3>
                <form onSubmit={handleApplyLeave} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Leave Type</label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value as any)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#006B99]"
                    >
                      <option value="Casual Leave">Casual Leave</option>
                      <option value="Medical Leave">Medical Leave</option>
                      <option value="Unpaid Leave">Unpaid Leave</option>
                      <option value="Week Off">Week Off</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Specified Date</label>
                    <input
                      type="date"
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Reason Statement</label>
                    <textarea
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="Please note application details..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none h-20"
                      required
                    />
                  </div>
                  <div className="flex gap-2.5 pt-2">
                    <button type="button" onClick={() => setShowApplyLeave(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
                    <button type="submit" className="flex-1 py-3 bg-[#006B99] hover:bg-[#004D6E] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">Submit</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Sliding Menu drawer for staff portal */}
        <AnimatePresence>
          {showMenu && (
            <>
              <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={() => setShowMenu(false)} />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="absolute left-0 top-0 bottom-0 w-64 bg-white z-50 shadow-2xl flex flex-col justify-between"
              >
                <div className="p-5 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Menu Option</p>
                    <button onClick={() => setShowMenu(false)} className="p-1 text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#006B99]/10 text-[#006B99] rounded-2xl flex items-center justify-center font-black text-xl">
                      {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 leading-tight block truncate uppercase">{user?.name?.split(' ')[0]}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">{user?.employeeId}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-3 space-y-1">
                  {[
                    { id: 'home', label: 'Punch Panel', icon: Clock },
                    { id: 'history', label: 'History Logs', icon: RefreshCw },
                    { id: 'leaves', label: 'Leave Requests', icon: Calendar },
                    { id: 'profile', label: 'My Profile', icon: UserIcon },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setShowMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all ${
                        activeTab === item.id ? 'bg-[#006B99]/10 text-[#006B99]' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="p-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-rose-50 hover:bg-rose-100/50 text-[#E73124] rounded-2xl text-xs font-bold uppercase tracking-wider"
                  >
                    <LogOut size={16} />
                    SIGN OUT
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Logout Password Confirmation modal */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <div className="fixed inset-0 bg-slate-900/60 z-55 flex items-center justify-center p-4 backdrop-blur-xs">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm text-center">
                <LogOut size={36} className="mx-auto text-[#E73124] mb-3" />
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-1">Verify Password</h3>
                <p className="text-xs text-slate-400 font-medium mb-4">Type current secret password key to sign out safely.</p>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="******"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm focus:outline-none mb-3"
                  autoFocus
                />
                {logoutError && <p className="text-[#E73124] text-[10px] font-bold mb-3">{logoutError}</p>}
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setShowLogoutConfirm(false); setPasswordConfirm(''); setLogoutError(''); }} 
                    className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="flex-1 py-3 bg-[#E73124] hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                  >
                    CONFIRM
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
