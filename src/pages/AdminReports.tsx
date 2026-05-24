import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { User, Location, AttendanceRecord } from '../types';
import { 
  FileText, Download, RefreshCw, Calendar, MapPin, Search, AlertCircle, Edit, Clock
} from 'lucide-react';
import { getTodayIST, formatTime, formatDate, getWeekDay, calculateBreakHours, getStatusColor, getStatusLabel } from '../lib/utils';
import AdminLayout from '../components/AdminLayout';
import * as XLSX from 'xlsx';

export default function AdminReports() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(getTodayIST());
  const [endDate, setEndDate] = useState(getTodayIST());
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [reportData, setReportData] = useState<AttendanceRecord[]>([]);
  const [triggered, setTriggered] = useState(false);

  // Manual Edit logs right from reports
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editBreakIn, setEditBreakIn] = useState('');
  const [editBreakOut, setEditBreakOut] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editWorkHours, setEditWorkHours] = useState('');
  const [editOvertime, setEditOvertime] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editLocationId, setEditLocationId] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState('');

  // Load basic criteria lists
  const loadFilters = useCallback(async () => {
    try {
      const [e, l] = await Promise.all([api.getEmployees(), api.getLocations()]);
      setEmployees(e.filter(emp => {
        const rLower = (emp.role || '').toLowerCase();
        return rLower !== 'admin' && rLower !== 'hr';
      }));
      setLocations(l);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const generateReport = async () => {
    setLoading(true);
    setTriggered(true);
    try {
      const allAttendance = await api.getAttendance();
      
      let filtered = allAttendance.filter(r => r.date >= startDate && r.date <= endDate);
      
      // Filter out records of users who are not in the valid employee registry (i.e., Admin & HR)
      filtered = filtered.filter(r => employees.some(e => e.employeeId === r.employeeId));
      
      if (selectedLocation) {
        filtered = filtered.filter(r => r.locationId === selectedLocation);
      }
      if (selectedEmployee) {
        filtered = filtered.filter(r => r.employeeId === selectedEmployee);
      }
      if (selectedStatus) {
        filtered = filtered.filter(r => r.status === selectedStatus);
      }

      setReportData(filtered.reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditDate(record.date || '');
    setEditCheckIn(record.checkIn ? new Date(record.checkIn).toISOString().slice(0, 16) : '');
    setEditBreakIn(record.breakIn ? new Date(record.breakIn).toISOString().slice(0, 16) : '');
    setEditBreakOut(record.breakOut ? new Date(record.breakOut).toISOString().slice(0, 16) : '');
    setEditCheckOut(record.checkOut ? new Date(record.checkOut).toISOString().slice(0, 16) : '');
    setEditWorkHours(record.workHours !== undefined ? record.workHours.toFixed(2) : '0.00');
    setEditOvertime(record.overtime !== undefined ? record.overtime.toFixed(2) : '0.00');
    setEditStatus(record.status || 'Present');
    setEditLocationId(record.locationId || '');
    setEditReason('');
    setEditError('');
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!editReason.trim()) {
      setEditError('Please enter a modification reason');
      return;
    }

    try {
      const updates: Partial<AttendanceRecord> = {
        date: editDate || undefined,
        checkIn: editCheckIn ? new Date(editCheckIn).toISOString() : null as any,
        breakIn: editBreakIn ? new Date(editBreakIn).toISOString() : null as any,
        breakOut: editBreakOut ? new Date(editBreakOut).toISOString() : null as any,
        checkOut: editCheckOut ? new Date(editCheckOut).toISOString() : null as any,
        workHours: parseFloat(editWorkHours) || 0,
        overtime: parseFloat(editOvertime) || 0,
        status: editStatus as any,
        locationId: editLocationId || undefined,
      };

      await api.editAttendance(editingRecord.id, updates, 'admin', editReason);
      setEditingRecord(null);
      await generateReport();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update attendance log');
    }
  };

  const exportToExcel = () => {
    const exportData = reportData.map(r => {
      const emp = employees.find(e => e.employeeId === r.employeeId);
      const loc = locations.find(l => l.id === r.locationId);
      return {
        'Staff ID': r.employeeId,
        'Staff Name': emp?.name || 'Unknown',
        'Location': loc?.name || 'Unknown',
        'Check In': r.checkIn ? formatTime(r.checkIn) : '---',
        'Break In': r.breakIn ? formatTime(r.breakIn) : '---',
        'Break Out': r.breakOut ? formatTime(r.breakOut) : '---',
        'Check Out': r.checkOut ? formatTime(r.checkOut) : '---',
        'Work Hr': r.workHours.toFixed(2),
        'Break Hr': calculateBreakHours(r.breakIn, r.breakOut).toFixed(2),
        'OT Hr': r.overtime.toFixed(2),
        'Status': getStatusLabel(r.status)
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance History');
    XLSX.writeFile(wb, `attendance_report_from_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <AdminLayout 
      title="Reports & Analytics" 
      subtitle="Assemble, analyze, and export employee spreadsheet files"
    >
      <div className="p-6 space-y-6">
        
        {/* Reports Filters layout exactly like screenshot design */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
            <FileText size={18} className="text-[#006B99]" />
            <h4 className="text-sm font-extrabold text-[#004D6E] uppercase tracking-wider">Reports & Spreadsheet Parameters</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">From Date</label>
              <input 
                type="date" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:bg-white focus:border-[#006B99]" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">To Date</label>
              <input 
                type="date" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:bg-white focus:border-[#006B99]" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Branch filter</label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 uppercase tracking-wide focus:outline-none focus:bg-white focus:border-[#006B99]" 
                value={selectedLocation} 
                onChange={e => setSelectedLocation(e.target.value)}
              >
                <option value="">All Branches</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1.5">
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Employee filter</label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 focus:outline-none" 
                value={selectedEmployee} 
                onChange={e => setSelectedEmployee(e.target.value)}
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.employeeId} value={emp.employeeId}>{emp.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Status State filter</label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 focus:outline-none" 
                value={selectedStatus} 
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {['Present', 'Absent', 'Leave', 'Week Off', 'Overtime'].map(st => (
                  <option key={st} value={st}>{st.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2.5">
              <button 
                onClick={generateReport} 
                className="flex-1 py-2.5 bg-[#006B99] hover:bg-[#004D6E] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl shadow-xs transition-transform flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Show Report
              </button>
              {reportData.length > 0 && (
                <button 
                  onClick={exportToExcel} 
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-widest rounded-xl shadow-xs transition-transform flex items-center justify-center gap-1.5 cursor-pointer animate-fade-in"
                >
                  <Download size={14} />
                  Export
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Query Ledger Results list */}
        {triggered && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-6 py-4.5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Assembled Report Logs</h4>
              <span className="px-2.5 py-0.5 bg-[#006B99]/10 text-[#006B99] text-[10px] font-black uppercase rounded-full">
                {reportData.length} records matching
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-black uppercase tracking-wider text-slate-400">
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
                  {reportData.map((record) => {
                    const emp = employees.find(e => e.employeeId === record.employeeId);
                    const loc = locations.find(l => l.id === record.locationId);
                    const bHrs = calculateBreakHours(record.breakIn, record.breakOut);
                    return (
                      <tr key={record.id} className="hover:bg-slate-50 transition-all font-semibold text-xs text-slate-600">
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-700">
                          {record.employeeId}
                        </td>
                        <td className="px-6 py-3.5">
                          <div>
                            <p className="font-extrabold text-slate-800 text-sm uppercase leading-3 mb-1">{emp?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{formatDate(record.date)} ({getWeekDay(record.date)})</p>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 uppercase text-[10px] font-extrabold text-slate-500">
                          {loc?.name || '---'}
                        </td>
                        <td className="px-6 py-3.5 font-mono">{record.checkIn ? formatTime(record.checkIn) : '---'}</td>
                        <td className="px-6 py-3.5 font-mono">{record.breakIn ? formatTime(record.breakIn) : '---'}</td>
                        <td className="px-6 py-3.5 font-mono">{record.breakOut ? formatTime(record.breakOut) : '---'}</td>
                        <td className="px-6 py-3.5 font-mono">{record.checkOut ? formatTime(record.checkOut) : '---'}</td>
                        <td className="px-6 py-3.5 font-black text-[#006B99]">{record.workHours.toFixed(2)} hr</td>
                        <td className="px-6 py-3.5 font-bold text-orange-600">{bHrs.toFixed(2)} hr</td>
                        <td className="px-6 py-3.5 font-bold text-emerald-600">{record.overtime.toFixed(2)} hr</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getStatusColor(record.status)}`}>
                            {getStatusLabel(record.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-16 text-slate-405 font-bold uppercase tracking-widest bg-slate-50/50">
                        No historical matched rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Manual Attendance Overwrite Modal dialog box */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-100 shadow-xl space-y-4 my-8">
            <div className="flex items-center gap-2 text-[#006B99] border-b border-slate-100 pb-3">
              <Clock size={20} />
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Manual Log Adjustment</h3>
            </div>

            <form onSubmit={handleUpdateRecord} className="space-y-4">
              <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Adjusting user</span>
                <p className="text-sm font-black text-slate-800 leading-tight uppercase mt-0.5">
                  {employees.find(e => e.employeeId === editingRecord.employeeId)?.name}
                </p>
                <p className="text-[10px] font-semibold text-slate-500">{editingRecord.employeeId} • {formatDate(editingRecord.date)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Log Date</label>
                  <input 
                    type="date" 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]" 
                    value={editDate} 
                    onChange={e => setEditDate(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Work Branch Site</label>
                  <select 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650"
                    value={editLocationId}
                    onChange={e => setEditLocationId(e.target.value)}
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Check In Time</label>
                  <input 
                    type="datetime-local" 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]" 
                    value={editCheckIn} 
                    onChange={e => setEditCheckIn(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Check Out Time</label>
                  <input 
                    type="datetime-local" 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]" 
                    value={editCheckOut} 
                    onChange={e => setEditCheckOut(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Break In Time</label>
                  <input 
                    type="datetime-local" 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]" 
                    value={editBreakIn} 
                    onChange={e => setEditBreakIn(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Break Out Time</label>
                  <input 
                    type="datetime-local" 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]" 
                    value={editBreakOut} 
                    onChange={e => setEditBreakOut(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Work Hr</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]" 
                    value={editWorkHours} 
                    onChange={e => setEditWorkHours(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">OT Hr</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]" 
                    value={editOvertime} 
                    onChange={e => setEditOvertime(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Status</label>
                  <select 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650"
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                  >
                    {['Present', 'Absent', 'Half Day', 'Full Day', 'Leave', 'Week Off', 'Overtime'].map(st => (
                      <option key={st} value={st}>{st.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Modification Reason (Required)</label>
                <textarea 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99] h-16" 
                  placeholder="e.g. Employee forgot to punch out due to client meeting..."
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  required
                />
              </div>

              {editError && (
                <p className="text-[#E73124] text-[10px] font-bold p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                  {editError}
                </p>
              )}

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingRecord(null)} 
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-[#006B99] hover:bg-[#004D6E] text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                >
                  Apply Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
