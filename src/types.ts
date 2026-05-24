export type UserRole = 'staff' | 'hr' | 'admin' | 'HR exicutive' | 'Manager' | 'accountent' | 'Store incharge';
export type UserStatus = 'active' | 'disabled' | 'inactive';
export type AttendanceStatus = 'Present' | 'Absent' | 'Full Day' | 'Half Day' | 'Leave' | 'Week Off' | 'Pending Leave' | 'Overtime';

export interface User {
  employeeId: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  department: string;
  locationId: string;
  phone?: string;
  password?: string;
  mobileBound?: boolean;
}

export interface Location {
  id: string;
  name: string;
  type: 'Office' | 'Store' | 'Warehouse';
  latitude: number;
  longitude: number;
  radius: number;
  breakTime: number; // minutes or hours based on UI, I'll stick to minutes internally but UI will handle hours
  workingHours: number; // hours
  weeklyOffDay: string;
  status?: 'active' | 'deactivated' | 'inactive';
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // ISO
  breakIn?: string;
  breakOut?: string;
  checkOut?: string;
  locationId: string;
  status: AttendanceStatus;
  workHours: number;
  overtime: number;
  isAutoCheckedOut?: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  date: string;
  endDate?: string;
  type: 'Leave' | 'Absent' | 'Week Off' | 'Full Day' | 'Half Day' | 'Casual' | 'Sick' | 'Casual Leave' | 'Medical Leave' | 'Unpaid Leave';
  reason: string;
  status: 'Pending Leave' | 'Leave' | 'Rejected';
  appliedAt: string;
  processedBy?: string;
  processedAt?: string;
}

export interface AuditLog {
  id: string;
  attendanceId: string;
  originalValue: string;
  newValue: string;
  editedBy: string;
  reason: string;
  timestamp: string;
}

export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeave: number;
  onBreak: number;
  overtimeCount: number;
  weeklyOff: number;
}
