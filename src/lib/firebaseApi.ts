import { 
  getAllFromCollection, 
  getFromCollection, 
  saveToCollection, 
  updateInCollection, 
  deleteFromCollection
} from './firebase';
import { User, Location, AttendanceRecord, LeaveRequest, AuditLog } from '../types';

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  LOCATIONS: 'locations',
  ATTENDANCE: 'attendance',
  LEAVES: 'leaves',
  AUDIT_LOGS: 'auditLogs',
  SESSIONS: 'sessions'
};

export const firebaseApi = {
  // ============ AUTHENTICATION ============
  async login(employeeId: string, password: string, deviceId: string) {
    const users = await getAllFromCollection<User>(COLLECTIONS.USERS);
    const user = users.find(u => u.employeeId === employeeId && u.password === password);
    
    if (!user) throw new Error('Invalid credentials');
    if (user.status === 'disabled' || user.status === 'inactive') {
      throw new Error('Account is disabled');
    }
    
    // Store session
    await saveToCollection(COLLECTIONS.SESSIONS, employeeId, {
      deviceId,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
    });
    
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, sessionId: deviceId };
  },

  async verifyPassword(employeeId: string, password: string): Promise<boolean> {
    const user = await getFromCollection<User>(COLLECTIONS.USERS, employeeId);
    return user?.password === password;
  },

  async checkSession(employeeId: string, sessionId: string): Promise<boolean> {
    const session = await getFromCollection<any>(COLLECTIONS.SESSIONS, employeeId);
    if (!session || session.deviceId !== sessionId) {
      throw new Error('Session expired. Please login again.');
    }
    return true;
  },

  // ============ LOCATIONS ============
  async getLocations(): Promise<Location[]> {
    return getAllFromCollection<Location>(COLLECTIONS.LOCATIONS);
  },

  async addLocation(data: Partial<Location>): Promise<Location> {
    const id = data.id || `LOC${Date.now()}`;
    return saveToCollection<Location>(COLLECTIONS.LOCATIONS, id, data);
  },

  async updateLocation(id: string, data: Partial<Location>): Promise<Location> {
    await updateInCollection(COLLECTIONS.LOCATIONS, id, data);
    const updated = await getFromCollection<Location>(COLLECTIONS.LOCATIONS, id);
    return updated!;
  },

  async deleteLocation(id: string): Promise<void> {
    await deleteFromCollection(COLLECTIONS.LOCATIONS, id);
  },

  // ============ EMPLOYEES ============
  async getEmployees(): Promise<User[]> {
    return getAllFromCollection<User>(COLLECTIONS.USERS);
  },

  async addEmployee(data: Partial<User>): Promise<User> {
    const id = data.employeeId;
    const existing = await getFromCollection(COLLECTIONS.USERS, id);
    if (existing) throw new Error('Employee ID already exists');
    return saveToCollection<User>(COLLECTIONS.USERS, id, data);
  },

  async updateEmployee(id: string, data: Partial<User>): Promise<User> {
    await updateInCollection(COLLECTIONS.USERS, id, data);
    const updated = await getFromCollection<User>(COLLECTIONS.USERS, id);
    return updated!;
  },

  async deleteEmployee(id: string): Promise<void> {
    await deleteFromCollection(COLLECTIONS.USERS, id);
  },

  async resetMobileBind(id: string): Promise<void> {
    await updateInCollection(COLLECTIONS.USERS, id, { mobileBound: false, deviceId: '' });
    await deleteFromCollection(COLLECTIONS.SESSIONS, id);
  },

  // ============ ATTENDANCE ============
  async getAttendance(): Promise<AttendanceRecord[]> {
    return getAllFromCollection<AttendanceRecord>(COLLECTIONS.ATTENDANCE);
  },

  async getAttendanceToday(): Promise<AttendanceRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    const all = await getAllFromCollection<AttendanceRecord>(COLLECTIONS.ATTENDANCE);
    return all.filter(r => r.date === today);
  },

  async punch(data: any): Promise<AttendanceRecord> {
    const id = `${data.employeeId}_${new Date().toISOString().split('T')[0]}`;
    const existing = await getFromCollection<AttendanceRecord>(COLLECTIONS.ATTENDANCE, id);
    
    if (existing) {
      await updateInCollection(COLLECTIONS.ATTENDANCE, id, data);
      return { ...existing, ...data, id };
    } else {
      return saveToCollection<AttendanceRecord>(COLLECTIONS.ATTENDANCE, id, data);
    }
  },

  async editAttendance(id: string, updates: Partial<AttendanceRecord>, editedBy: string, reason: string): Promise<AttendanceRecord> {
    await updateInCollection(COLLECTIONS.ATTENDANCE, id, updates);
    
    // Add audit log
    await saveToCollection(COLLECTIONS.AUDIT_LOGS, `LOG${Date.now()}`, {
      attendanceId: id,
      editedBy,
      reason,
      updates,
      timestamp: new Date().toISOString()
    });
    
    const updated = await getFromCollection<AttendanceRecord>(COLLECTIONS.ATTENDANCE, id);
    return updated!;
  },

  // ============ LEAVES ============
  async getLeaves(): Promise<LeaveRequest[]> {
    return getAllFromCollection<LeaveRequest>(COLLECTIONS.LEAVES);
  },

  async applyLeave(data: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const id = `LEV${Date.now()}`;
    const leaveData = {
      ...data,
      id,
      status: 'Pending Leave',
      appliedAt: new Date().toISOString()
    };
    return saveToCollection<LeaveRequest>(COLLECTIONS.LEAVES, id, leaveData);
  },

  async processLeave(id: string, status: string, processedBy: string): Promise<LeaveRequest> {
    await updateInCollection(COLLECTIONS.LEAVES, id, {
      status,
      processedBy,
      processedAt: new Date().toISOString()
    });
    const updated = await getFromCollection<LeaveRequest>(COLLECTIONS.LEAVES, id);
    return updated!;
  },

  // ============ AUDIT LOGS ============
  async getAuditLogs(): Promise<AuditLog[]> {
    return getAllFromCollection<AuditLog>(COLLECTIONS.AUDIT_LOGS);
  },

  // ============ BULK IMPORT ============
  async importEmployees(employeesList: any[]): Promise<{ added: number; skipped: number }> {
    let added = 0, skipped = 0;
    for (const emp of employeesList) {
      try {
        await this.addEmployee(emp);
        added++;
      } catch {
        skipped++;
      }
    }
    return { added, skipped };
  },

  async importAttendance(attendanceList: any[]): Promise<{ added: number; skipped: number }> {
    let added = 0, skipped = 0;
    for (const att of attendanceList) {
      try {
        await this.punch(att);
        added++;
      } catch {
        skipped++;
      }
    }
    return { added, skipped };
  }
};