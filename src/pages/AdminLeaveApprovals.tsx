import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { LeaveRequest, User } from '../types';
import { 
  Calendar, Check, X, AlertCircle, RefreshCw, Eye, History, FileText
} from 'lucide-react';
import { formatDate, getStatusColor } from '../lib/utils';
import AdminLayout from '../components/AdminLayout';

export default function AdminLeaveApprovals() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Historical date range filter states
  const [histStartDate, setHistStartDate] = useState('');
  const [histEndDate, setHistEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allLeaves, allEmployees] = await Promise.all([
        api.getLeaves(), 
        api.getEmployees()
      ]);
      setEmployees(allEmployees.filter(emp => {
        const rLower = (emp.role || '').toLowerCase();
        return rLower !== 'admin' && rLower !== 'hr';
      }));
      setLeaves(allLeaves.reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleProcess = async (id: string, status: 'Leave' | 'Rejected') => {
    try {
      await api.processLeave(id, status, 'admin');
      await load();
    } catch (err) {
      alert('Failed to process request.');
    }
  };

  const pendingLeaves = leaves.filter(l => l.status === 'Pending Leave' && employees.some(e => e.employeeId === l.employeeId));
  const processedLeaves = leaves.filter(l => l.status !== 'Pending Leave' && employees.some(e => e.employeeId === l.employeeId));

  const filteredProcessedLeaves = processedLeaves.filter(leave => {
    if (histStartDate && leave.date < histStartDate) return false;
    if (histEndDate && leave.date > histEndDate) return false;
    return true;
  });

  return (
    <AdminLayout 
      title="Leave Approvals" 
      subtitle="Review pending applications, sick logs, and off-duty request notes"
      onRefresh={load}
      loading={loading}
    >
      <div className="p-6 space-y-6">
        
        {/* Active applications pane */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4.5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Staff Leave Requests</h4>
            <span className="px-2.5 py-0.5 bg-[#006B99]/10 text-[#006B99] text-[10px] font-black uppercase rounded-full">
              {pendingLeaves.length} PENDING
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3.5">Staff Member</th>
                  <th className="px-6 py-3.5">Type Mode</th>
                  <th className="px-6 py-3.5">Reason Explanatory</th>
                  <th className="px-6 py-3.5">Date Period</th>
                  <th className="px-6 py-3.5">Application State</th>
                  <th className="px-6 py-3.5 text-right w-44">Approve / Decline Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingLeaves.map((leave) => {
                  const emp = employees.find(e => e.employeeId === leave.employeeId);
                  return (
                    <tr key={leave.id} className="hover:bg-slate-50 transition-all font-semibold text-xs text-slate-600">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-extrabold text-slate-100 text-sm uppercase leading-3 mb-1 text-slate-800">{emp?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{leave.employeeId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 bg-sky-50 text-[#006B99] border border-sky-100 rounded-lg text-[10px] font-extrabold uppercase">
                          {leave.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate text-slate-705" title={leave.reason}>
                        {leave.reason}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-820 font-mono">
                        {formatDate(leave.date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-bold uppercase rounded-full">
                          PENDING
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 text-right">
                          <button
                            onClick={() => handleProcess(leave.id, 'Rejected')}
                            className="px-3 py-1.5 border border-red-200 text-[#E73124] hover:bg-rose-50 text-[10px] font-bold uppercase transition-all rounded-lg cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleProcess(leave.id, 'Leave')}
                            className="px-3 py-1.5 bg-emerald-55 hover:bg-emerald-600 text-white bg-emerald-600 text-[10px] font-bold uppercase tracking-wide transition-all rounded-lg cursor-pointer"
                          >
                            Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {pendingLeaves.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                      No Pending requests Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historics approvals ledger lists */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4.5 border-b border-slate-150 bg-slate-50 flex flex-wrap items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-slate-500" />
              <h4 className="text-sm font-extrabold text-[#004D6E] uppercase tracking-wide">Historical Archive approved logs</h4>
            </div>

            {/* Date-to-Date Select Filter Option */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest text-slate-400">From</span>
                <input
                  type="date"
                  value={histStartDate}
                  onChange={(e) => setHistStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold uppercase tracking-wide text-[10px] text-slate-600 focus:outline-none focus:border-[#006B99] focus:ring-1 focus:ring-[#006B99]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest text-slate-400">To</span>
                <input
                  type="date"
                  value={histEndDate}
                  onChange={(e) => setHistEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold uppercase tracking-wide text-[10px] text-slate-600 focus:outline-none focus:border-[#006B99] focus:ring-1 focus:ring-[#006B99]"
                />
              </div>
              {(histStartDate || histEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setHistStartDate('');
                    setHistEndDate('');
                  }}
                  className="px-2.5 py-2.5 bg-slate-200 hover:bg-slate-350 hover:bg-slate-300 text-slate-600 font-extrabold text-[9px] uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Leave Category</th>
                  <th className="px-6 py-3">Applied on Date</th>
                  <th className="px-6 py-3">Status State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProcessedLeaves.map((leave) => {
                  const emp = employees.find(e => e.employeeId === leave.employeeId);
                  return (
                    <tr key={leave.id} className="hover:bg-slate-50 transition-all font-semibold text-xs text-slate-600">
                      <td className="px-6 py-3">
                        <p className="font-extrabold text-slate-800 uppercase leading-3 mb-1">{emp?.name || leave.employeeId}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight tracking-wider">{leave.employeeId}</p>
                      </td>
                      <td className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider">{leave.type}</td>
                      <td className="px-6 py-3 font-mono font-bold">{formatDate(leave.date)}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getStatusColor(leave.status)}`}>
                          {leave.status === 'Leave' ? 'APPROVED' : leave.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredProcessedLeaves.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                      No processed historical records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
