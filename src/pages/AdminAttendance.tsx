import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { User, Location, AttendanceRecord } from '../types';
import { 
  Home, RefreshCw, Calendar, MapPin, 
  Search, AlertCircle, Edit, Save, Trash2, Check, Clock
} from 'lucide-react';
import { getTodayIST, formatTime, formatDate, calculateBreakHours, getStatusColor, getStatusLabel, getWeekDay } from '../lib/utils';
import AdminLayout from '../components/AdminLayout';

export default function AdminAttendance() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(getTodayIST());
  const [endDate, setEndDate] = useState(getTodayIST());
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Bulk import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Editing logic
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

  const handleDownloadDemoCSV = () => {
    // Generate some demo data based on actual employees if available
    const demoEmps = employees.slice(0, 3);
    const emp1 = demoEmps[0]?.employeeId || "staff101";
    const emp2 = demoEmps[1]?.employeeId || "staff102";
    const emp3 = demoEmps[2]?.employeeId || "staff103";
    const todayStr = getTodayIST();

    const headers = ["employeeId", "date", "checkIn", "breakIn", "breakOut", "checkOut", "status", "workHours", "overtime"];
    
    const rows = [
      headers.join(","),
      `${emp1},${todayStr},${todayStr} 09:00:00,${todayStr} 13:00:00,${todayStr} 14:00:00,${todayStr} 18:00:00,Present,8.0,0.0`,
      `${emp2},${todayStr},${todayStr} 08:45:00,,,${todayStr} 17:45:00,Present,9.0,0.0`,
      `${emp3},${todayStr},,,,,Absent,0,0`
    ].join("\n");

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_demo_excel.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportError('');
    setImportSuccessMsg('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) {
          setImportError('File is empty');
          setImportLoading(false);
          return;
        }

        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) {
          setImportError('File needs a header row and at least one data row');
          setImportLoading(false);
          return;
        }

        const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        const findColIndex = (names: string[]) => {
          return rawHeaders.findIndex(h => names.some(n => h.toLowerCase() === n.toLowerCase()));
        };

        const empIdIdx = findColIndex(['employeeid', 'employee_id', 'staffid', 'staff_id', 'id']);
        const dateIdx = findColIndex(['date', 'log_date']);
        const checkInIdx = findColIndex(['checkin', 'check_in', 'time_in', 'punch_in']);
        const breakInIdx = findColIndex(['breakin', 'break_in', 'lunch_out']);
        const breakOutIdx = findColIndex(['breakout', 'break_out', 'lunch_in']);
        const checkOutIdx = findColIndex(['checkout', 'check_out', 'time_out', 'punch_out']);
        const statusIdx = findColIndex(['status', 'attendance_status']);
        const workHoursIdx = findColIndex(['workhours', 'work_hours', 'hours_worked']);
        const overtimeIdx = findColIndex(['overtime', 'overtime_hours']);

        if (empIdIdx === -1 || dateIdx === -1) {
          setImportError('CSV must at least contain "employeeId" and "date" columns.');
          setImportLoading(false);
          return;
        }

        const list: any[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.trim().replace(/^["']|["']$/g, ''));
          if (row.length < Math.min(empIdIdx, dateIdx) + 1) continue;

          const employeeId = row[empIdIdx];
          const date = row[dateIdx];
          if (!employeeId || !date) continue;

          const checkIn = checkInIdx !== -1 && row[checkInIdx] ? row[checkInIdx] : null;
          const breakIn = breakInIdx !== -1 && row[breakInIdx] ? row[breakInIdx] : null;
          const breakOut = breakOutIdx !== -1 && row[breakOutIdx] ? row[breakOutIdx] : null;
          const checkOut = checkOutIdx !== -1 && row[checkOutIdx] ? row[checkOutIdx] : null;

          const status = statusIdx !== -1 && row[statusIdx] ? row[statusIdx] : null;
          const workHours = workHoursIdx !== -1 && row[workHoursIdx] ? parseFloat(row[workHoursIdx]) : null;
          const overtime = overtimeIdx !== -1 && row[overtimeIdx] ? parseFloat(row[overtimeIdx]) : null;

          list.push({
            employeeId,
            date,
            checkIn,
            breakIn,
            breakOut,
            checkOut,
            status,
            workHours,
            overtime
          });
        }

        if (list.length === 0) {
          setImportError('No valid rows found to import.');
          setImportLoading(false);
          return;
        }

        const result = await api.importAttendance(list);
        setImportSuccessMsg(`Import complete! Loaded ${result.added} logs. Skipped ${result.skipped} rows (unmatched Employee ID or duplicates).`);
        await load();
      } catch (err: any) {
        setImportError(err.message || 'Error parsing or uploading file. Make sure column formats are correct.');
      } finally {
        setImportLoading(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read file');
      setImportLoading(false);
    };

    reader.readAsText(file);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allAttendance, allEmployees, allLocations] = await Promise.all([
        api.getAttendance(), 
        api.getEmployees(), 
        api.getLocations()
      ]);
      setEmployees(allEmployees.filter(emp => {
        const rLower = (emp.role || '').toLowerCase();
        return rLower !== 'admin' && rLower !== 'hr';
      }));
      setLocations(allLocations);
      setRecords(allAttendance.reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const emp = employees.find(e => e.employeeId === r.employeeId);
      if (!emp) return false;
      const dateMatch = r.date >= startDate && r.date <= endDate;
      const locMatch = !selectedLocation || r.locationId === selectedLocation;
      const statusMatch = !selectedStatus || r.status === selectedStatus;
      const searchMatch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      return dateMatch && locMatch && statusMatch && searchMatch;
    });
  }, [records, employees, startDate, endDate, selectedLocation, selectedStatus, searchTerm]);

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
      await load();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update attendance log');
    }
  };

  return (
    <AdminLayout 
      title="Attendance Register" 
      subtitle="View, edit, and audit historical clock logs"
      onRefresh={load}
      loading={loading}
    >
      <div className="p-6 space-y-6">
        
        {/* Date Filter & Search toolbar exactly matching standard design palette */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="text-sm font-extrabold text-[#004D6E] uppercase tracking-wider">Attendance Register Filter Option</h4>
              <button
                onClick={() => {
                  setImportError('');
                  setImportSuccessMsg('');
                  setShowImportModal(true);
                }}
                className="px-3.5 py-1.5 bg-[#006B99] hover:bg-[#004D6E] text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm shadow-[#006B99]/15"
              >
                + IMPORT REGISTER (EXCEL)
              </button>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name / ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:bg-white focus:border-[#006B99] transition-all min-w-[200px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
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
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 uppercase tracking-widest focus:outline-none focus:bg-white focus:border-[#006B99]" 
                value={selectedLocation} 
                onChange={e => setSelectedLocation(e.target.value)}
              >
                <option value="">All Branches</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Status filter</label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 uppercase tracking-widest focus:outline-none focus:bg-white focus:border-[#006B99]" 
                value={selectedStatus} 
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Full Day">Full Day</option>
                <option value="Half Day">Half Day</option>
                <option value="Overtime">Overtime</option>
                <option value="Absent">Absent</option>
                <option value="Leave">On Leave</option>
                <option value="Week Off">Week Off</option>
                <option value="Pending Leave">Pending</option>
              </select>
            </div>
            <div className="flex items-end text-right">
              <button 
                onClick={load} 
                className="w-full py-2.5 bg-[#006B99] hover:bg-[#004D6E] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                Refresh Range
              </button>
            </div>
          </div>
        </div>

        {/* History Register logs card list */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black uppercase text-slate-400">
                  <th className="px-6 py-4">Staff ID</th>
                  <th className="px-6 py-4">Staff Name</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Break In</th>
                  <th className="px-6 py-4">Break Out</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4">Work Hr</th>
                  <th className="px-6 py-4">Break Hr</th>
                  <th className="px-6 py-4">OT Hr</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const emp = employees.find(e => e.employeeId === record.employeeId);
                  if (!emp) return null;
                  const loc = locations.find(l => l.id === record.locationId);
                  const bHrs = calculateBreakHours(record.breakIn, record.breakOut);

                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition-all text-xs text-slate-600 font-semibold">
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-755">
                        {record.employeeId}
                      </td>
                      <td className="px-6 py-3.5">
                        <div>
                          <p className="font-extrabold text-slate-800 text-sm uppercase leading-3 mb-1">{emp.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">{formatDate(record.date)} ({getWeekDay(record.date)})</p>
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
                      <td className="px-6 py-3.5 font-bold text-emerald-605">{record.overtime.toFixed(2)} hr</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border ${getStatusColor(record.status)}`}>
                          {getStatusLabel(record.status)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <button 
                          onClick={() => handleEditClick(record)} 
                          className="p-2 border border-slate-200 text-[#006B99] hover:bg-[#006B99]/5 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                          title="Manual Edit Logs"
                        >
                          <Edit size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                      No Records Found For Active Filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Simple Mobile Card List view */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredRecords.map((record) => {
              const emp = employees.find(e => e.employeeId === record.employeeId);
              if (!emp) return null;
              const bHrs = calculateBreakHours(record.breakIn, record.breakOut);
              return (
                <div key={record.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm uppercase leading-tight">{emp.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Date: {formatDate(record.date)}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wide ${getStatusColor(record.status)}`}>
                      {getStatusLabel(record.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <div>
                      <span className="text-slate-400 uppercase font-black text-[9px]">Check In</span>
                      <p className="font-mono mt-0.5 font-bold text-slate-700">{record.checkIn ? formatTime(record.checkIn) : '---'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase font-black text-[9px]">Check Out</span>
                      <p className="font-mono mt-0.5 font-bold text-slate-700">{record.checkOut ? formatTime(record.checkOut) : '---'}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-150">
                      <span className="text-slate-400 uppercase font-black text-[9px]">Hours work</span>
                      <p className="font-bold text-[#006B99] mt-0.5">{record.workHours.toFixed(1)}h</p>
                    </div>
                    <div className="pt-2 border-t border-slate-150 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 uppercase font-black text-[9px]">Break Total</span>
                        <p className="font-bold text-orange-600 mt-0.5">{bHrs.toFixed(1)}h</p>
                      </div>
                      <button 
                        onClick={() => handleEditClick(record)}
                        className="p-1 px-2.5 bg-[#006B99]/5 text-[#006B99] rounded-lg font-bold text-[10px] uppercase border border-[#006B99]/10"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredRecords.length === 0 && (
              <div className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                No Records Found
              </div>
            )}
          </div>

        </div>

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

      {/* Bulk CSV/Excel Attendance Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[#006B99] border-b border-slate-100 pb-3">
              <Calendar size={20} />
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Bulk Import Attendance</h3>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 font-semibold">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-2">
                <p className="font-extrabold text-slate-700 uppercase text-[10px]">💡 CSV / Excel Columns Required:</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px] text-slate-550">
                  <div>• <b className="text-slate-750">employeeId</b> (Required)</div>
                  <div>• <b className="text-slate-750">date</b> (YYYY-MM-DD / Required)</div>
                  <div>• <b className="text-slate-750">checkIn</b> (YYYY-MM-DD HH:MM:ss)</div>
                  <div>• <b className="text-slate-750">checkOut</b> (YYYY-MM-DD HH:MM:ss)</div>
                  <div>• <b className="text-slate-750">breakIn</b> (Optional)</div>
                  <div>• <b className="text-slate-750">breakOut</b> (Optional)</div>
                  <div>• <b className="text-slate-750">status</b> (Optional)</div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Step 1: Download Demo Excel File</p>
                <button
                  type="button"
                  onClick={handleDownloadDemoCSV}
                  className="px-4 py-2 border border-[#006B99]/30 text-[#006B99] bg-[#006B99]/5 hover:bg-[#006B99]/10 text-[10px] font-extrabold rounded-xl uppercase tracking-wider cursor-pointer"
                >
                  Download Demo Excel (CSV)
                </button>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Step 2: Upload Completed Spreadsheet</p>
                <div className="relative border-2 border-dashed border-slate-200 hover:border-[#006B99]/50 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-slate-50/20 transition-all">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportFile}
                    disabled={importLoading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-700 uppercase">
                      {importLoading ? 'Validating and Importing...' : 'Select CSV/Excel File'}
                    </p>
                    <p className="text-[10px] text-slate-450 font-bold lowercase">
                      (supports comma separated sheets double-clickable in microsoft excel)
                    </p>
                  </div>
                </div>
              </div>

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-[10px] font-black text-[#E73124] uppercase leading-tight">
                  ⚠️ Error: {importError}
                </div>
              )}

              {importSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-[10px] font-black text-[#006B99] uppercase leading-tight bg-sky-50 border-sky-100 text-[#006B99]">
                  🎉 {importSuccessMsg}
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportError('');
                  setImportSuccessMsg('');
                }}
                className="w-full py-3 bg-[#006B99] hover:bg-[#004D6E] text-white rounded-xl text-xs font-bold uppercase cursor-pointer text-center"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
