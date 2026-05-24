import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { User, Location, AttendanceRecord, LeaveRequest } from '../types';
import { 
  Users, UserCheck, UserMinus, Calendar, 
  Search, RefreshCw, MapPin
} from 'lucide-react';
import { getTodayIST, formatTime, calculateBreakHours, getStatusColor, getStatusLabel, formatDate, getWeekDay } from '../lib/utils';
import AdminLayout from '../components/AdminLayout';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allAttendance, allEmployees, allLocations, allLeaves] = await Promise.all([
        api.getAttendance(),
        api.getEmployees(),
        api.getLocations(),
        api.getLeaves()
      ]);
      setEmployees(allEmployees.filter(emp => {
        const rLower = (emp.role || '').toLowerCase();
        return rLower !== 'admin' && rLower !== 'hr';
      }));
      setLocations(allLocations);
      setRecords(allAttendance.reverse());
      setLeaves(allLeaves);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todayStr = getTodayIST();

  // Calculate stats for cards
  const stats = useMemo(() => {
    const activeStaff = employees.filter(emp => emp.status === 'active');
    const totalCount = activeStaff.length;
    
    // Today's attendance records
    const todayRecords = records.filter(r => r.date === todayStr);
    const presentCount = todayRecords.filter(r => r.checkIn && r.status !== 'Leave' && r.status !== 'Week Off' && r.status !== 'Absent').length;
    
    // Leave for today
    const leavesToday = leaves.filter(l => l.date === todayStr && l.status === 'Leave');
    const leaveCount = leavesToday.length;
    
    // Week Off
    const weekOffCount = activeStaff.filter(emp => {
      const loc = locations.find(l => l.id === emp.locationId);
      if (!loc) return false;
      const todayDay = new Date(todayStr).toLocaleDateString('en-US', { weekday: 'long' });
      return loc.weeklyOffDay === todayDay;
    }).length;
    
    // Absent count
    const absentCount = Math.max(0, totalCount - presentCount - leaveCount - weekOffCount);

    return {
      total: totalCount,
      present: presentCount,
      absent: absentCount,
      leaves: leaveCount,
      weekOff: weekOffCount
    };
  }, [employees, records, leaves, locations, todayStr]);

  // Recent activity data - today's attendance with filters
  const recentActivity = useMemo(() => {
    // Get today's records
    const todayRecords = records.filter(r => r.date === todayStr);
    
    // Map to full attendance data, filtering out unlisted profiles (Admins/HRs)
    const data = todayRecords
      .map(record => {
        const emp = employees.find(e => e.employeeId === record.employeeId);
        if (!emp) return null;
        const loc = locations.find(l => l.id === record.locationId);
        
        return {
          id: record.id,
          employeeId: record.employeeId,
          employeeName: emp.name,
          locationName: loc?.name || 'Unknown',
          locationId: record.locationId,
          checkIn: record.checkIn,
          breakIn: record.breakIn,
          breakOut: record.breakOut,
          checkOut: record.checkOut,
          workHours: record.workHours,
          breakHours: calculateBreakHours(record.breakIn, record.breakOut),
          overtime: record.overtime,
          status: record.status
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    
    // Apply filters
    let filtered = data;
    
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (locationFilter) {
      filtered = filtered.filter(item => item.locationId === locationFilter);
    }
    
    // Sort by check-in time (latest first)
    return filtered.sort((a, b) => {
      if (!a.checkIn) return 1;
      if (!b.checkIn) return -1;
      return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime();
    });
  }, [records, employees, locations, todayStr, searchTerm, locationFilter]);

  // Get present/today status display
  const getStatusDisplay = (status: string) => {
    if (status === 'Present' || status === 'Full Day') return 'Present / Full Day';
    if (status === 'Half Day') return 'Present / Half Day';
    return getStatusLabel(status);
  };

  return (
    <AdminLayout 
      title="Dashboard" 
      subtitle="Operational summary & real-time attendance stream"
      onRefresh={loadData}
      loading={loading}
    >
      <div className="p-6 space-y-6">
        
        {/* 6 Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* Card 1: Total Active Staff */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#006B99]/10 rounded-xl flex items-center justify-center">
                <Users size={20} className="text-[#006B99]" />
              </div>
              <span className="text-2xl font-black text-[#006B99]">{stats.total}</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Active Staff</p>
          </div>

          {/* Card 2: Today Present */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <UserCheck size={20} className="text-emerald-600" />
              </div>
              <span className="text-2xl font-black text-emerald-600">{stats.present}</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today Present</p>
          </div>

          {/* Card 3: Today Absent */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                <UserMinus size={20} className="text-[#E73124]" />
              </div>
              <span className="text-2xl font-black text-[#E73124]">{stats.absent}</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today Absent</p>
          </div>

          {/* Card 4: Today Leave */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Calendar size={20} className="text-amber-600" />
              </div>
              <span className="text-2xl font-black text-amber-600">{stats.leaves}</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today Leave</p>
          </div>

          {/* Card 5: Today Week Off */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <RefreshCw size={20} className="text-purple-600" />
              </div>
              <span className="text-2xl font-black text-purple-600">{stats.weekOff}</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today Week Off</p>
          </div>

          {/* Card 6: Attendance Rate */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users size={20} className="text-blue-600" />
              </div>
              <span className="text-2xl font-black text-blue-600">
                {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Attendance Rate</p>
          </div>

        </div>

        {/* Recent Activity Card */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Header with filters */}
          <div className="px-6 py-5 border-b border-slate-150 bg-slate-50/50">
            <h3 className="text-base font-black text-slate-800 tracking-tight mb-4">Recent Activity</h3>
            
            {/* Filter options */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:border-[#006B99] focus:ring-2 focus:ring-[#006B99]/10 transition-all"
                />
              </div>
              
              <div className="w-full sm:w-64">
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 font-medium focus:outline-none focus:border-[#006B99] focus:ring-2 focus:ring-[#006B99]/10 transition-all cursor-pointer"
                >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-150 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3.5">Staff ID</th>
                  <th className="px-6 py-3.5">Staff Name</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Check In</th>
                  <th className="px-6 py-3.5">Break In</th>
                  <th className="px-6 py-3.5">Break Out</th>
                  <th className="px-6 py-3.5">Check Out</th>
                  <th className="px-6 py-3.5">Work Hr</th>
                  <th className="px-6 py-3.5">Break Hr</th>
                  <th className="px-6 py-3.5">OT Hr</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentActivity.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-all text-sm">
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-600">
                      {item.employeeId}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-extrabold text-slate-800 text-sm uppercase">
                        {item.employeeName}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">
                        {item.locationName}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold">
                      {item.checkIn ? formatTime(item.checkIn) : '---'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold">
                      {item.breakIn ? formatTime(item.breakIn) : '---'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold">
                      {item.breakOut ? formatTime(item.breakOut) : '---'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold">
                      {item.checkOut ? formatTime(item.checkOut) : '---'}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-[#006B99]">
                      {item.workHours ? `${item.workHours.toFixed(1)}h` : '---'}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-orange-600">
                      {item.breakHours ? `${item.breakHours.toFixed(1)}h` : '---'}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-emerald-600">
                      {item.overtime ? `${item.overtime.toFixed(1)}h` : '---'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${getStatusColor(item.status)}`}>
                        {getStatusDisplay(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                
                {recentActivity.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest">
                      No attendance records found for today
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {recentActivity.map((item) => (
              <div key={item.id} className="p-4 space-y-3 hover:bg-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-extrabold text-slate-800 text-sm uppercase">{item.employeeName}</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">ID: {item.employeeId}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${getStatusColor(item.status)}`}>
                    {getStatusDisplay(item.status)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[9px]">Location</span>
                    <p className="font-bold text-slate-700 mt-0.5 uppercase text-[10px]">{item.locationName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[9px]">Check In</span>
                    <p className="font-mono font-bold text-slate-700 mt-0.5">{item.checkIn ? formatTime(item.checkIn) : '---'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[9px]">Check Out</span>
                    <p className="font-mono font-bold text-slate-700 mt-0.5">{item.checkOut ? formatTime(item.checkOut) : '---'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[9px]">Work / Break</span>
                    <p className="font-bold text-[#006B99] mt-0.5">{item.workHours?.toFixed(1)}h / {item.breakHours?.toFixed(1)}h</p>
                  </div>
                </div>
              </div>
            ))}
            
            {recentActivity.length === 0 && (
              <div className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest">
                No attendance records found for today
              </div>
            )}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}