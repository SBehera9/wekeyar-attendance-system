import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Location } from '../types';
import { 
  MapPin, Plus, Edit, Trash2, AlertCircle, RefreshCw, 
  Settings, Clock, Compass, HelpCircle, Power, X
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../context/AuthContext';

export default function AdminLocations() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState('');

  // Confirmation modal states
  const [confirmAction, setConfirmAction] = useState<'delete' | 'deactivate' | 'activate' | null>(null);
  const [confirmTargetId, setConfirmTargetId] = useState('');
  const [confirmTargetName, setConfirmTargetName] = useState('');

  const [form, setForm] = useState<Partial<Location>>({ 
    id: '', 
    name: '', 
    latitude: 20.296059, 
    longitude: 85.824539, 
    radius: 100, 
    type: 'office', 
    workingHours: 9, 
    breakTime: 60, 
    weeklyOffDay: 'Sunday' 
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const l = await api.getLocations();
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

  const handleEditClick = (loc: Location) => {
    setEditingId(loc.id);
    setForm(loc);
    setShowModal(true);
    setErrorForm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm('');
    try {
      if (editingId) {
        await api.updateLocation(editingId, form);
      } else {
        await api.addLocation(form);
      }
      setShowModal(false);
      setEditingId(null);
      await load();
    } catch (err: any) {
      setErrorForm(err.message || 'Operation failed. Check if branch site ID is unique.');
    }
  };

  const executeDeleteLocation = async (id: string) => {
    try {
      await api.deleteLocation(id);
      await load();
      setConfirmAction(null);
    } catch (err) {
      console.error('Failed to delete work location:', err);
    }
  };

  const executeDeactivateLocation = async (id: string) => {
    try {
      await api.updateLocation(id, { status: 'inactive' });
      await load();
      setConfirmAction(null);
    } catch (err) {
      console.error('Failed to deactivate work location:', err);
    }
  };

  const executeActivateLocation = async (id: string) => {
    try {
      await api.updateLocation(id, { status: 'active' });
      await load();
      setConfirmAction(null);
    } catch (err) {
      console.error('Failed to activate work location:', err);
    }
  };

  return (
    <AdminLayout 
      title="Work Locations" 
      subtitle="Define geographical branches and geofence geocoordinates"
      onRefresh={load}
      loading={loading}
    >
      <div className="p-6 space-y-6">
        
        {/* Top filter + action pane with modern look */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-3">Operations Site manager</span>
            <p className="text-sm font-extrabold text-[#004D6E] uppercase tracking-wider mt-1.5">Registered company branches</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm({ id: '', name: '', latitude: 20.296059, longitude: 85.824539, radius: 100, type: 'office', workingHours: 9, breakTime: 60, weeklyOffDay: 'Sunday' });
                setShowModal(true);
                setErrorForm('');
              }}
              className="px-5 py-2.5 bg-[#006B99] hover:bg-[#004D6E] text-white rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-[#006B99]/15 transition-all cursor-pointer"
            >
              <Plus size={16} className="stroke-[2.5]" />
              Add Branch
            </button>
          )}
        </div>

        {/* Real site cards bento grids exactly like screenshot images */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {locations.map((loc) => (
            <div key={loc.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              
              {/* Top info and operational flags */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#006B99]/10 text-[#006B99] rounded-2xl flex items-center justify-center border border-[#006B99]/10 shadow-3xs">
                    <MapPin size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-base leading-tight uppercase">{loc.name}</h4>
                    <p className="text-[10px] text-slate-405 font-bold uppercase mt-0.5">ID: {loc.id}</p>
                  </div>
                </div>

                {loc.status === 'deactivated' || loc.status === 'inactive' ? (
                  <span className="px-2.5 py-0.5 bg-rose-50 text-[#E73124] border border-rose-100 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse">
                    DEACTIVATED
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-wider">
                    OPERATIONAL
                  </span>
                )}
              </div>

              {/* Geographical and restriction figures layout */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wide">Coordinates</span>
                  <p className="font-mono text-[11px] text-[#004D6E] tracking-tight">{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wide">Geofence radius</span>
                  <p className="text-slate-850 font-extrabold">{loc.radius}m Allowed</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wide">Shift Required</span>
                  <p className="text-slate-850 font-extrabold">{loc.workingHours} Hours/Day</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wide">Break Allowance</span>
                  <p className="text-slate-850 font-extrabold">{loc.breakTime} Minutes/Day</p>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-150">
                  <span className="text-slate-400 font-bold uppercase tracking-wide mt-1">Weekly Off</span>
                  <p className="text-sky-600 font-extrabold mt-1">{loc.weeklyOffDay}</p>
                </div>
              </div>

              {/* Action operations row */}
              {isAdmin && (
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleEditClick(loc)}
                    className="flex-1 py-2 border border-slate-200 hover:bg-[#006B99]/5 font-extrabold text-[11px] uppercase tracking-wider text-[#006B99] rounded-xl transition-all cursor-pointer text-center"
                  >
                    Edit Branch
                  </button>

                  {loc.status === 'deactivated' || loc.status === 'inactive' ? (
                    <button
                      onClick={() => {
                        setConfirmAction('activate');
                        setConfirmTargetId(loc.id);
                        setConfirmTargetName(loc.name);
                      }}
                      className="px-3 py-2 border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer font-bold text-[11px] uppercase tracking-wider flex-shrink-0"
                      title="Activate branch site"
                    >
                      Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmAction('deactivate');
                        setConfirmTargetId(loc.id);
                        setConfirmTargetName(loc.name);
                      }}
                      className="px-3 py-2 border border-rose-200 text-[#E73124] hover:bg-rose-50 rounded-xl transition-all cursor-pointer font-bold text-[11px] uppercase tracking-wider flex-shrink-0 animate-pulse"
                      title="Deactivate branch site"
                    >
                      Deactivate
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setConfirmAction('delete');
                      setConfirmTargetId(loc.id);
                      setConfirmTargetName(loc.name);
                    }}
                    className="p-2 border border-red-200 text-[#E73124] hover:bg-rose-50 rounded-xl transition-all cursor-pointer flex-shrink-0"
                    title="Remove location branch"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

            </div>
          ))}

          {locations.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white border border-slate-200 rounded-3xl text-slate-400 font-bold uppercase tracking-widest">
              <MapPin size={48} className="mx-auto text-slate-300 mb-3" />
              <span>Empty Company Footprint locations</span>
            </div>
          )}
        </div>

      </div>

      {/* Add / Edit branch Modal dialog box */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[#006B99] border-b border-slate-100 pb-3">
              <Compass size={20} />
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {editingId ? 'Modify Branch Settings' : 'Add New Branch'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Branch Name</label>
                  <input
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Branch Code (ID)</label>
                  <input
                    type="text"
                    placeholder="e.g. CSPUR"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#006B99]"
                    value={form.id || ''}
                    onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })}
                    required
                    disabled={!!editingId}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">GPS Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                    value={form.latitude || ''}
                    onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">GPS Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                    value={form.longitude || ''}
                    onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Permitted Radius (meters)</label>
                  <input
                    type="number"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                    value={form.radius || 100}
                    onChange={(e) => setForm({ ...form, radius: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Type Category</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650"
                    value={form.type || 'office'}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  >
                    <option value="office">office</option>
                    <option value="retail outlet">retail outlet</option>
                    <option value="warehouse">warehouse</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Shift Hours Needed</label>
                  <input
                    type="number"
                    step="0.5"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                    value={form.workingHours || 9}
                    onChange={(e) => setForm({ ...form, workingHours: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Break Time Limit (mins)</label>
                  <input
                    type="number"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                    value={form.breakTime || 60}
                    onChange={(e) => setForm({ ...form, breakTime: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Weekly Off Day</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 uppercase"
                  value={form.weeklyOffDay || 'Sunday'}
                  onChange={(e) => setForm({ ...form, weeklyOffDay: e.target.value })}
                >
                  <option value="manage by outlet">manage by outlet</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>

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
                  {editingId ? 'Modify Site' : 'Add Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Actions Safety Popups (Delete / Deactivate / Activate Branch Site) */}
      {confirmAction !== null && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-xl space-y-4 text-center">
            <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center ${
              confirmAction === 'delete' || confirmAction === 'deactivate' ? 'bg-red-50 text-[#E73124]' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {confirmAction === 'delete' ? <Trash2 size={24} /> :
               confirmAction === 'deactivate' ? <Power size={24} className="animate-spin text-[#E73124]" /> : <Power size={24} />}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Are you sure?</h3>
              <p className="text-xs text-slate-500 font-semibold">
                {confirmAction === 'delete' ? (
                  <>You are about to delete <span className="font-extrabold text-slate-700 uppercase">{confirmTargetName}</span>. All employees assigned here will lose active site boundary validations. This cannot be undone.</>
                ) : confirmAction === 'deactivate' ? (
                  <>You are about to <span className="text-[#E73124] font-black">DEACTIVATE</span> the branch site <span className="font-extrabold text-slate-700 uppercase">{confirmTargetName}</span>. Assigned employees will be locked from punching attendance.</>
                ) : (
                  <>You are about to activate the branch site <span className="font-extrabold text-slate-700 uppercase">{confirmTargetName}</span>. Assigned employees will be allowed to punch attendance.</>
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
                    executeDeleteLocation(confirmTargetId);
                  } else if (confirmAction === 'deactivate') {
                    executeDeactivateLocation(confirmTargetId);
                  } else if (confirmAction === 'activate') {
                    executeActivateLocation(confirmTargetId);
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

    </AdminLayout>
  );
}
