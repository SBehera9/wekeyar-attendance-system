import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { User, Location } from '../types';
import { 
  Users, Plus, Search, MapPin, Briefcase, 
  Trash2, Edit, AlertCircle, RefreshCw, Key, Shield, Smartphone, UserX, UserCheck
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../context/AuthContext';

export default function AdminEmployees() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
  const [employees, setEmployees] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  // Bulk import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Custom action confirmation modal state
  const [confirmAction, setConfirmAction] = useState<'delete' | 'resetBind' | 'deactivate' | 'activate' | null>(null);
  const [confirmTargetId, setConfirmTargetId] = useState('');
  const [confirmTargetName, setConfirmTargetName] = useState('');

  // Form modals state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState('');
  const [form, setForm] = useState<Partial<User>>({ 
    role: 'Staff', 
    status: 'active', 
    name: '', 
    employeeId: '', 
    password: '', 
    locationId: '',
    department: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, l] = await Promise.all([api.getEmployees(), api.getLocations()]);
      setEmployees(e.filter(emp => {
        const rLower = (emp.role || '').toLowerCase();
        return rLower !== 'admin' && rLower !== 'hr';
      }));
      setLocations(l);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const nameMatch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      const locMatch = !selectedLocation || emp.locationId === selectedLocation;
      return nameMatch && locMatch;
    });
  }, [employees, searchTerm, selectedLocation]);

  const handleDownloadDemoEmployeesCSV = () => {
    const locId = locations[0]?.id || "L001";
    const headers = ["employeeId", "name", "password", "department", "role", "locationId"];
    const rows = [
      headers.join(","),
      `staff105,SUDARSHAN BEHERA,123456,Accounts,Staff,${locId}`,
      `staff106,MOHAMMED ISMAIL,123456,Sales,Manager,${locId}`
    ].join("\n");

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `employees_demo_excel.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportEmployees = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setImportError('File needs headers and at least one row');
          setImportLoading(false);
          return;
        }

        const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const findColIndex = (names: string[]) => {
          return rawHeaders.findIndex(h => names.some(n => h.toLowerCase() === n.toLowerCase()));
        };

        const empIdIdx = findColIndex(['employeeid', 'employee_id', 'staffid', 'staff_id', 'id']);
        const nameIdx = findColIndex(['name', 'employee_name', 'staff_name', 'full_name']);
        const passwordIdx = findColIndex(['password', 'pass', 'secret']);
        const departmentIdx = findColIndex(['department', 'dept']);
        const roleIdx = findColIndex(['role', 'designation', 'role_type']);
        const locationIdIdx = findColIndex(['locationid', 'location_id', 'branch_id', 'branchid']);

        if (empIdIdx === -1 || nameIdx === -1) {
          setImportError('CSV must at least contain "employeeId" and "name" columns.');
          setImportLoading(false);
          return;
        }

        const list: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.trim().replace(/^["']|["']$/g, ''));
          if (row.length < Math.min(empIdIdx, nameIdx) + 1) continue;

          const employeeId = row[empIdIdx];
          const name = row[nameIdx];
          if (!employeeId || !name) continue;

          list.push({
            employeeId,
            name,
            password: passwordIdx !== -1 && row[passwordIdx] ? row[passwordIdx] : "123456",
            department: departmentIdx !== -1 && row[departmentIdx] ? row[departmentIdx] : "General",
            role: roleIdx !== -1 && row[roleIdx] ? row[roleIdx] : "Staff",
            locationId: locationIdIdx !== -1 && row[locationIdIdx] ? row[locationIdIdx] : (locations[0]?.id || '')
          });
        }

        if (list.length === 0) {
          setImportError('No valid rows found to import.');
          setImportLoading(false);
          return;
        }

        const result = await api.importEmployees(list);
        setImportSuccessMsg(`Import successful! ${result.added} employees provisioned. Skipped ${result.skipped} duplicates or incomplete rows.`);
        await load();
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse sheet file. Choose active work branch ID.');
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

  const handleEditClick = (emp: User) => {
    setEditingId(emp.employeeId);
    setForm({
      ...emp,
      password: '' // Don't prefill existing passwords for security
    });
    setShowModal(true);
    setErrorForm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm('');
    try {
      if (!form.locationId) {
        setErrorForm('Please select an assigned work site branch');
        return;
      }
      if (editingId) {
        await api.updateEmployee(editingId, form);
      } else {
        await api.addEmployee(form);
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ role: 'Staff', status: 'active', name: '', employeeId: '', password: '', locationId: '', department: '' });
      await load();
    } catch (err: any) {
      setErrorForm(err.message || 'Operation failed. Check if employee ID is unique.');
    }
  };

  const executeDeleteEmployee = async (id: string) => {
    try {
      await api.deleteEmployee(id);
      await load();
      setConfirmAction(null);
    } catch (err) {
      console.error('Failed to delete user record:', err);
    }
  };

  const executeDeactivateEmployee = async (id: string) => {
    try {
      await api.updateEmployee(id, { status: 'inactive' });
      await load();
      setConfirmAction(null);
    } catch (err) {
      console.error('Failed to deactivate employee:', err);
    }
  };

  const executeActivateEmployee = async (id: string) => {
    try {
      await api.updateEmployee(id, { status: 'active' });
      await load();
      setConfirmAction(null);
    } catch (err) {
      console.error('Failed to activate employee:', err);
    }
  };

  const executeResetBind = async (employeeId: string) => {
    try {
      await api.resetMobileBind(employeeId);
      await load();
      setConfirmAction(null);
    } catch (err) {
      console.error('Reset bind failed:', err);
    }
  };

  return (
    <AdminLayout 
      title="Staff Registry" 
      subtitle="Provision and manage company employee personnel accounts"
      onRefresh={load}
      loading={loading}
    >
      <div className="p-6 space-y-6">
        
        {/* Table Filter Topbar */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:bg-white focus:border-[#006B99] transition-all min-w-[200px]"
              />
            </div>

            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-bold uppercase tracking-wide focus:outline-none focus:bg-white focus:border-[#006B99]"
            >
              <option value="">All Branches</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setImportError('');
                  setImportSuccessMsg('');
                  setShowImportModal(true);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#006B99] rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              >
                + IMPORT (EXCEL)
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm({ role: 'Staff', status: 'active', name: '', employeeId: '', password: '', locationId: '', department: '' });
                  setShowModal(true);
                  setErrorForm('');
                }}
                className="px-5 py-2.5 bg-[#006B99] hover:bg-[#004D6E] text-white rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-[#006B99]/15 transition-all cursor-pointer"
              >
                <Plus size={16} className="stroke-[2.5]" />
                Add Staff
              </button>
            </div>
          )}
        </div>

        {/* Staff registry Table list board */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4.5 border-b border-slate-150 bg-slate-50">
            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Employee Records</h4>
          </div>

          {/* Table display */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3.5">Employee Details</th>
                  <th className="px-6 py-3.5">ID</th>
                  <th className="px-6 py-3.5">Branch Assign</th>
                  <th className="px-6 py-3.5">Designation Role</th>
                  <th className="px-6 py-3.5">Hardware Bind status</th>
                  <th className="px-6 py-3.5">Working State</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right w-36">Action Tool</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const locName = locations.find(l => l.id === emp.locationId)?.name || 'Unassigned';
                  return (
                    <tr key={emp.employeeId} className="hover:bg-slate-50 transition-all font-semibold text-xs text-slate-600">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#006B99]/10 text-[#006B99] flex items-center justify-center font-black text-sm uppercase">
                            {emp.name?.[0] || 'S'}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-800 text-sm uppercase leading-3 mb-1">{emp.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{emp.department || 'General'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">
                        {emp.employeeId}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-150 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                          {locName.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 uppercase text-[10px] font-extrabold text-slate-500">
                        {emp.role}
                      </td>
                      <td className="px-6 py-4">
                        {emp.deviceId ? (
                          <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[10px] uppercase">
                            <Smartphone size={13} />
                            Locked
                          </div>
                        ) : (
                          <span className="text-slate-400 font-extrabold text-[10px] uppercase">Unlocked</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider ${
                          emp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-[#E73124] border-red-100'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => {
                                setConfirmAction('resetBind');
                                setConfirmTargetId(emp.employeeId);
                                setConfirmTargetName(emp.name);
                              }}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-lg transition-all cursor-pointer"
                              title="Reset Mobile Lock key & Signout"
                            >
                              <Key size={13} />
                            </button>
                            {emp.status === 'active' ? (
                              <button
                                onClick={() => {
                                  setConfirmAction('deactivate');
                                  setConfirmTargetId(emp.employeeId);
                                  setConfirmTargetName(emp.name);
                                }}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 border border-slate-200 rounded-lg transition-all cursor-pointer animate-pulse"
                                title="Deactivate & block login"
                              >
                                <UserX size={13} />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setConfirmAction('activate');
                                  setConfirmTargetId(emp.employeeId);
                                  setConfirmTargetName(emp.name);
                                }}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                title="Activate & allow login"
                              >
                                <UserCheck size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditClick(emp)}
                              className="p-1.5 text-[#006B99] hover:bg-[#006B99]/5 border border-slate-200 rounded-lg transition-all cursor-pointer"
                              title="Edit User Detail"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setConfirmAction('delete');
                                setConfirmTargetId(emp.employeeId);
                                setConfirmTargetName(emp.name);
                              }}
                              className="p-1.5 text-[#E73124] hover:bg-red-50 border border-red-200 rounded-lg transition-all cursor-pointer"
                              title="Terminate User access"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                      Roster Records are Empty
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Edit and Provision account Modal dialog box */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[#006B99] border-b border-slate-100 pb-3">
              <Users size={20} />
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {editingId ? 'Modify Staff Profile' : 'Provision New Account'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Employee Name</label>
                  <input
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Employe Unique ID</label>
                  <input
                    type="text"
                    placeholder="e.g. staff101"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]"
                    value={form.employeeId || ''}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    required
                    disabled={!!editingId}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Secret Password</label>
                  <input
                    type="password"
                    placeholder={editingId ? 'Leave blank to retain' : '******'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]"
                    value={form.password || ''}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={!editingId}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Department (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Sales, Accounts"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]"
                    value={form.department || ''}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Assigned Work Branch</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 uppercase tracking-wide focus:outline-none"
                    value={form.locationId || ''}
                    onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                    required
                  >
                    <option value="">Branch List</option>
                    {locations
                      .filter(l => l.status !== 'inactive' && l.status !== 'deactivated' || l.id === form.locationId)
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name.toUpperCase()} { (l.status === 'deactivated' || l.status === 'inactive') ? '(DEACTIVATED)' : '' }
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Designation</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 focus:outline-none"
                    value={form.role || 'Staff'}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                  >
                    <option value="HR">HR</option>
                    <option value="Staff">Staff</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Manager">Manager</option>
                    <option value="Store in charge">Store in charge</option>
                  </select>
                </div>
              </div>

              {editingId && (
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Status State</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 focus:outline-none"
                    value={form.status || 'active'}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  >
                    <option value="active">ACTIVE</option>
                    <option value="inactive">INACTIVE</option>
                  </select>
                </div>
              )}

              {errorForm && (
                <p className="text-[#E73124] text-[10px] font-bold p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                  {errorForm}
                </p>
              )}

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#006B99] hover:bg-[#004D6E] text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                >
                  {editingId ? 'Modify Details' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Actions Safety Popups (Delete / Reset Device Link / Status Deactivations) */}
      {confirmAction !== null && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-xl space-y-4 text-center">
            <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center ${
              confirmAction === 'delete' || confirmAction === 'deactivate' ? 'bg-red-50 text-[#E73124]' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {confirmAction === 'delete' ? <Trash2 size={24} /> :
               confirmAction === 'deactivate' ? <UserX size={24} /> :
               confirmAction === 'activate' ? <UserCheck size={24} /> : <Key size={24} />}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Are you sure?</h3>
              <p className="text-xs text-slate-500 font-semibold">
                {confirmAction === 'delete' ? (
                  <>You are about to delete <span className="font-extrabold text-slate-700 uppercase">{confirmTargetName}</span>'s account record. This action cannot be undone.</>
                ) : confirmAction === 'deactivate' ? (
                  <>You are about to make <span className="font-extrabold text-slate-700 uppercase">{confirmTargetName}</span>'s account <span className="text-red-650 font-black">INACTIVE</span>. They will be deactivated and blocked from logging in immediately.</>
                ) : confirmAction === 'activate' ? (
                  <>You are about to activate <span className="font-extrabold text-slate-700 uppercase">{confirmTargetName}</span>'s account. They will be allowed to log in and record attendance.</>
                ) : (
                  <>You are about to reset the secure device binding key lock for <span className="font-extrabold text-slate-700 uppercase">{confirmTargetName}</span>.</>
                )}
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold uppercase cursor-pointer hover:bg-slate-50"
              >
                No, Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === 'delete') {
                    executeDeleteEmployee(confirmTargetId);
                  } else if (confirmAction === 'deactivate') {
                    executeDeactivateEmployee(confirmTargetId);
                  } else if (confirmAction === 'activate') {
                    executeActivateEmployee(confirmTargetId);
                  } else {
                    executeResetBind(confirmTargetId);
                  }
                }}
                className={`flex-1 py-3 text-white rounded-xl text-xs font-bold uppercase cursor-pointer ${
                  confirmAction === 'delete' || confirmAction === 'deactivate' ? 'bg-[#E73124] hover:bg-[#c92015]' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV/Excel Employee Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[#006B99] border-b border-slate-100 pb-3">
              <Users size={18} className="stroke-[2.5]" />
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Bulk Import Employees</h3>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 font-semibold">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-2">
                <p className="font-extrabold text-slate-700 uppercase text-[10px]">💡 CSV / Excel Columns Required:</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px] text-slate-550">
                  <div>• <b className="text-slate-750">employeeId</b> (Required)</div>
                  <div>• <b className="text-slate-750">name</b> (Required)</div>
                  <div>• <b className="text-slate-750">password</b> (Optional)</div>
                  <div>• <b className="text-slate-750">department</b> (Optional)</div>
                  <div>• <b className="text-slate-750">role</b> (Optional)</div>
                  <div>• <b className="text-slate-750">locationId</b> (Optional)</div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Step 1: Download Demo Excel File</p>
                <button
                  type="button"
                  onClick={handleDownloadDemoEmployeesCSV}
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
                    onChange={handleImportEmployees}
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
