import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

// Storage paths
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const LOCATIONS_FILE = path.join(DATA_DIR, "locations.json");
const ATTENDANCE_FILE = path.join(DATA_DIR, "attendance.json");
const LEAVES_FILE = path.join(DATA_DIR, "leaves.json");
const AUDIT_LOGS_FILE = path.join(DATA_DIR, "audit_logs.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions
function loadData<T>(file: string, defaultValue: T): T {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.error(`Error loading ${file}:`, e);
      return defaultValue;
    }
  }
  return defaultValue;
}

function saveData<T>(file: string, data: T) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Initialize data
let users = loadData<any[]>(USERS_FILE, []);

// Default admin and HR accounts
const defaultAdmin = { employeeId: "admin", password: "admin123", name: "Admin", role: "admin", status: "active", department: "IT", locationId: "LOC001" };
const defaultHR = { employeeId: "hr", password: "hr123", name: "HR Manager", role: "hr", status: "active", department: "HR", locationId: "LOC001" };

const adminIdx = users.findIndex((u: any) => u.employeeId === "admin");
if (adminIdx === -1) users.push(defaultAdmin);
else users[adminIdx] = { ...users[adminIdx], ...defaultAdmin };

const hrIdx = users.findIndex((u: any) => u.employeeId === "hr");
if (hrIdx === -1) users.push(defaultHR);
else users[hrIdx] = { ...users[hrIdx], ...defaultHR };

// Ensure at least one staff exists
if (users.length <= 2) {
  users.push({ employeeId: "staff001", password: "staff", name: "John Staff", role: "staff", status: "active", department: "Field", locationId: "LOC001" });
}

saveData(USERS_FILE, users);

let locations = loadData<any[]>(LOCATIONS_FILE, [
  { 
    id: "LOC001", 
    name: "Main Office", 
    type: "Office", 
    latitude: 28.6139, 
    longitude: 77.2090, 
    radius: 500,
    breakTime: 60, 
    workingHours: 9, 
    weeklyOffDay: "Sunday",
    status: "active"
  }
]);
saveData(LOCATIONS_FILE, locations);

let attendance = loadData<any[]>(ATTENDANCE_FILE, []);
let leaves = loadData<any[]>(LEAVES_FILE, []);
let auditLogs = loadData<any[]>(AUDIT_LOGS_FILE, []);
let sessionsData = loadData<Record<string, string>>(SESSIONS_FILE, {});

let activeSessions = new Map(Object.entries(sessionsData));

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// ============ AUTH ROUTES ============
app.post("/api/auth/login", (req, res) => {
  const { employeeId, password, deviceId } = req.body;
  const user = users.find((u: any) => u.employeeId === employeeId && u.password === password);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (user.status === "disabled" || user.status === "inactive") {
    return res.status(403).json({ error: "Access denied. Your employee account is currently marked as Inactive." });
  }

  activeSessions.set(employeeId, deviceId);
  saveData(SESSIONS_FILE, Object.fromEntries(activeSessions));

  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword, sessionId: deviceId });
});

app.post("/api/auth/session-check", (req, res) => {
  const { employeeId, sessionId } = req.body;
  if (activeSessions.get(employeeId) !== sessionId) {
    return res.status(401).json({ error: "Multiple logins detected. Session expired." });
  }
  res.json({ status: "ok" });
});

app.post("/api/auth/verify-password", (req, res) => {
  const { employeeId, password } = req.body;
  const user = users.find((u: any) => u.employeeId === employeeId && u.password === password);
  res.json({ valid: !!user });
});

// ============ LOCATION ROUTES ============
app.get("/api/locations", (req, res) => {
  res.json(locations);
});

app.post("/api/locations", (req, res) => {
  const newLoc = { ...req.body, status: req.body.status || "active" };
  if (!newLoc.id) newLoc.id = `LOC${Date.now()}`;
  locations.push(newLoc);
  saveData(LOCATIONS_FILE, locations);
  res.json(newLoc);
});

app.patch("/api/locations/:id", (req, res) => {
  const { id } = req.params;
  const index = locations.findIndex((l: any) => l.id === id);
  if (index === -1) return res.status(404).json({ error: "Location not found" });
  locations[index] = { ...locations[index], ...req.body };
  saveData(LOCATIONS_FILE, locations);
  res.json(locations[index]);
});

app.delete("/api/locations/:id", (req, res) => {
  const { id } = req.params;
  const index = locations.findIndex((l: any) => l.id === id);
  if (index === -1) return res.status(404).json({ error: "Location not found" });
  locations.splice(index, 1);
  saveData(LOCATIONS_FILE, locations);
  res.status(204).send();
});

// ============ EMPLOYEE ROUTES ============
app.get("/api/employees", (req, res) => {
  const employeesWithoutPassword = users.map(({ password, ...u }: any) => u);
  res.json(employeesWithoutPassword);
});

app.post("/api/employees", (req, res) => {
  const { employeeId } = req.body;
  if (users.find((u: any) => u.employeeId === employeeId)) {
    return res.status(400).json({ error: "Employee ID already exists" });
  }
  const newUser = { ...req.body, status: req.body.status || "active" };
  users.push(newUser);
  saveData(USERS_FILE, users);
  const { password, ...userWithoutPassword } = newUser;
  res.json(userWithoutPassword);
});

app.patch("/api/employees/:id", (req, res) => {
  const { id } = req.params;
  const index = users.findIndex((u: any) => u.employeeId === id);
  if (index === -1) return res.status(404).json({ error: "Employee not found" });
  
  users[index] = { ...users[index], ...req.body };
  saveData(USERS_FILE, users);
  const { password, ...userWithoutPassword } = users[index];
  res.json(userWithoutPassword);
});

app.patch("/api/employees/:id/reset-bind", (req, res) => {
  const { id } = req.params;
  const index = users.findIndex((u: any) => u.employeeId === id);
  if (index === -1) return res.status(404).json({ error: "Employee not found" });
  
  users[index].mobileBound = false;
  users[index].deviceId = ""; // Clear device link
  activeSessions.delete(id); // Automatic employee device signout!
  saveData(USERS_FILE, users);
  saveData(SESSIONS_FILE, Object.fromEntries(activeSessions));
  res.json({ status: "ok" });
});

app.delete("/api/employees/:id", (req, res) => {
  const { id } = req.params;
  const index = users.findIndex((u: any) => u.employeeId === id);
  if (index === -1) return res.status(404).json({ error: "Employee not found" });
  
  users.splice(index, 1);
  saveData(USERS_FILE, users);
  res.status(204).send();
});

// ============ ATTENDANCE ROUTES ============
app.get("/api/attendance", (req, res) => {
  res.json(attendance);
});

app.get("/api/attendance/today", (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json(attendance.filter((a: any) => a.date === today));
});

app.post("/api/attendance/punch", (req, res) => {
  const { employeeId, type, locationId, timestamp, latitude, longitude } = req.body;
  const date = new Date(timestamp).toISOString().split('T')[0];
  
  let record = attendance.find((a: any) => a.employeeId === employeeId && a.date === date);
  
  if (type === 'checkIn') {
    if (record) return res.status(400).json({ error: "Already checked in today" });
    record = { 
      id: `ATT${Date.now()}`,
      employeeId, 
      date, 
      checkIn: timestamp, 
      locationId,
      status: 'Present',
      workHours: 0,
      overtime: 0
    };
    attendance.push(record);
  } else {
    if (!record) return res.status(400).json({ error: "No check-in record found" });
    
    if (type === 'breakIn') {
      if (record.breakIn) return res.status(400).json({ error: "Break already taken" });
      record.breakIn = timestamp;
    } else if (type === 'breakOut') {
      if (!record.breakIn) return res.status(400).json({ error: "No break-in found" });
      if (record.breakOut) return res.status(400).json({ error: "Already returned from break" });
      record.breakOut = timestamp;
    } else if (type === 'checkOut') {
      if (record.checkOut) return res.status(400).json({ error: "Already checked out" });
      record.checkOut = timestamp;
      
      const loc = locations.find((l: any) => l.id === record.locationId);
      if (loc) {
        const start = new Date(record.checkIn).getTime();
        const end = new Date(record.checkOut).getTime();
        const breakStart = record.breakIn ? new Date(record.breakIn).getTime() : 0;
        const breakEnd = record.breakOut ? new Date(record.breakOut).getTime() : 0;
        
        let actualBreakMs = breakEnd > breakStart ? breakEnd - breakStart : 0;
        const allowedBreakMs = loc.breakTime * 60 * 1000;
        const extraBreakMs = Math.max(0, actualBreakMs - allowedBreakMs);
        
        const totalMs = end - start;
        const workMs = totalMs - actualBreakMs - extraBreakMs;
        
        record.workHours = workMs / (1000 * 60 * 60);
        record.overtime = Math.max(0, record.workHours - loc.workingHours);
        
        const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(record.date));
        if (dayOfWeek === loc.weeklyOffDay) {
          record.status = 'Week Off';
        } else {
          record.status = record.workHours >= loc.workingHours ? 'Full Day' : 'Half Day';
          if (record.overtime > 0) record.status = 'Overtime';
        }
      }
    }
  }
  
  saveData(ATTENDANCE_FILE, attendance);
  res.json(record);
});

app.patch("/api/attendance/:id", (req, res) => {
  const { id } = req.params;
  const { updates, editedBy, reason } = req.body;
  const index = attendance.findIndex((a: any) => a.id === id);
  if (index === -1) return res.status(404).json({ error: "Attendance record not found" });

  const original = { ...attendance[index] };
  attendance[index] = { ...attendance[index], ...updates };

  const record = attendance[index];
  const loc = locations.find((l: any) => l.id === record.locationId);
  if (loc && record.checkIn && record.checkOut) {
    if (updates.workHours === undefined) {
      const start = new Date(record.checkIn).getTime();
      const end = new Date(record.checkOut).getTime();
      const breakStart = record.breakIn ? new Date(record.breakIn).getTime() : 0;
      const breakEnd = record.breakOut ? new Date(record.breakOut).getTime() : 0;
      let actualBreakMs = breakEnd > breakStart ? breakEnd - breakStart : 0;
      const allowedBreakMs = loc.breakTime * 60 * 1000;
      const extraBreakMs = Math.max(0, actualBreakMs - allowedBreakMs);
      const totalMs = end - start;
      const workMs = totalMs - actualBreakMs - extraBreakMs;
      record.workHours = workMs / (1000 * 60 * 60);
    }
    
    if (updates.overtime === undefined) {
      record.overtime = Math.max(0, record.workHours - loc.workingHours);
    }
    
    if (updates.status === undefined) {
      const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(record.date));
      if (dayOfWeek === loc.weeklyOffDay) {
        record.status = 'Week Off';
      } else {
        record.status = record.workHours >= loc.workingHours ? 'Full Day' : 'Half Day';
        if (record.overtime > 0) record.status = 'Overtime';
      }
    }
  }

  const log = {
    id: `LOG${Date.now()}`,
    attendanceId: id,
    originalValue: JSON.stringify(original),
    newValue: JSON.stringify(attendance[index]),
    editedBy,
    reason,
    timestamp: new Date().toISOString()
  };
  auditLogs.push(log);
  
  saveData(ATTENDANCE_FILE, attendance);
  saveData(AUDIT_LOGS_FILE, auditLogs);
  res.json(attendance[index]);
});

// ============ LEAVE ROUTES ============
app.get("/api/leaves", (req, res) => {
  res.json(leaves);
});

app.post("/api/leaves", (req, res) => {
  const { employeeId, date, endDate, type, reason } = req.body;
  
  const monthStr = date.substring(0, 7);
  const existing = leaves.filter((l: any) => l.employeeId === employeeId && l.date.startsWith(monthStr));
  if (existing.length >= 3) {
    return res.status(400).json({ error: "Maximum 3 requests allowed per calendar month" });
  }

  const newLeave = {
    id: `LEV${Date.now()}`,
    employeeId,
    date,
    endDate,
    type,
    reason,
    status: 'Pending Leave',
    appliedAt: new Date().toISOString()
  };
  leaves.push(newLeave);
  saveData(LEAVES_FILE, leaves);
  res.json(newLeave);
});

app.patch("/api/leaves/:id", (req, res) => {
  const { id } = req.params;
  const { status, processedBy } = req.body;
  const index = leaves.findIndex((l: any) => l.id === id);
  if (index === -1) return res.status(404).json({ error: "Leave request not found" });

  leaves[index].status = status;
  leaves[index].processedBy = processedBy;
  leaves[index].processedAt = new Date().toISOString();

  if (status === 'Leave') {
    const leave = leaves[index];
    const existingAtt = attendance.find((a: any) => a.employeeId === leave.employeeId && a.date === leave.date);
    const user = users.find((u: any) => u.employeeId === leave.employeeId);
    const loc = locations.find((l: any) => l.id === user?.locationId);
    
    let finalStatus = 'Leave';
    if (loc) {
      const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(leave.date));
      if (dayOfWeek === loc.weeklyOffDay) {
        finalStatus = 'Week Off';
      }
    }

    if (!existingAtt) {
      attendance.push({
        id: `ATT_L${Date.now()}`,
        employeeId: leave.employeeId,
        date: leave.date,
        status: finalStatus,
        locationId: user?.locationId || '',
        workHours: 0,
        overtime: 0
      });
    } else {
      existingAtt.status = finalStatus;
    }
    saveData(ATTENDANCE_FILE, attendance);
  }

  saveData(LEAVES_FILE, leaves);
  res.json(leaves[index]);
});

// ============ AUDIT LOGS ROUTES ============
app.get("/api/audit-logs", (req, res) => {
  res.json(auditLogs);
});

// ============ BULK IMPORT ENDPOINTS ============
app.post("/api/employees/bulk-import", (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: "Expected an array of employees" });
  }
  let addedCount = 0;
  let skippedCount = 0;
  for (const item of list) {
    if (!item.employeeId || !item.name) {
      skippedCount++;
      continue;
    }
    const currentId = String(item.employeeId).trim();
    if (users.find((u: any) => u.employeeId === currentId)) {
      skippedCount++;
      continue;
    }
    const newUser = {
      employeeId: currentId,
      name: String(item.name).trim(),
      password: String(item.password || "123456").trim(),
      department: String(item.department || "General").trim(),
      role: String(item.role || "Staff").trim(),
      locationId: item.locationId || (locations[0]?.id || ""),
      status: "active",
      mobileBound: false,
      deviceId: ""
    };
    users.push(newUser);
    addedCount++;
  }
  saveData(USERS_FILE, users);
  res.json({ success: true, added: addedCount, skipped: skippedCount });
});

app.post("/api/attendance/bulk-import", (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: "Expected an array of attendance records" });
  }
  let addedCount = 0;
  let skippedCount = 0;
  let uIndex = 0;
  for (const item of list) {
    uIndex++;
    if (!item.employeeId || !item.date) {
      skippedCount++;
      continue;
    }
    const currentEmpId = String(item.employeeId).trim();
    const currentDate = String(item.date).trim();
    
    const existingIndex = attendance.findIndex((a: any) => a.employeeId === currentEmpId && a.date === currentDate);
    const matchedEmp = users.find((u: any) => u.employeeId === currentEmpId);
    if (!matchedEmp) {
      // Skipped because the employee doesn't exist
      skippedCount++;
      continue;
    }
    
    const locationId = item.locationId || matchedEmp.locationId || (locations[0]?.id || "");
    const loc = locations.find((l: any) => l.id === locationId);
    
    const checkIn = item.checkIn ? new Date(item.checkIn).toISOString() : "";
    const breakIn = item.breakIn ? new Date(item.breakIn).toISOString() : null;
    const breakOut = item.breakOut ? new Date(item.breakOut).toISOString() : null;
    const checkOut = item.checkOut ? new Date(item.checkOut).toISOString() : null;
    
    let workHours = parseFloat(item.workHours) || 0;
    let overtime = parseFloat(item.overtime) || 0;
    let status = item.status || "Present";

    if (checkIn && checkOut && !item.workHours) {
      const start = new Date(checkIn).getTime();
      const end = new Date(checkOut).getTime();
      const breakStart = breakIn ? new Date(breakIn).getTime() : 0;
      const breakEnd = breakOut ? new Date(breakOut).getTime() : 0;
      let actualBreakMs = breakEnd > breakStart ? breakEnd - breakStart : 0;
      
      const allowedBreakMs = loc ? loc.breakTime * 60 * 1000 : 0;
      const extraBreakMs = Math.max(0, actualBreakMs - allowedBreakMs);
      const totalMs = end - start;
      const workMs = totalMs - actualBreakMs - extraBreakMs;
      workHours = Math.max(0, workMs / (1000 * 60 * 60));
      
      if (loc) {
        overtime = Math.max(0, workHours - loc.workingHours);
        const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(currentDate));
        if (dayOfWeek === loc.weeklyOffDay) {
          status = 'Week Off';
        } else {
          status = workHours >= loc.workingHours ? 'Full Day' : 'Half Day';
          if (overtime > 0) status = 'Overtime';
        }
      }
    }
    
    const record = {
      id: existingIndex !== -1 ? attendance[existingIndex].id : `ATT${Date.now()}_import_${uIndex}`,
      employeeId: currentEmpId,
      date: currentDate,
      checkIn: checkIn || null,
      breakIn: breakIn || null,
      breakOut: breakOut || null,
      checkOut: checkOut || null,
      locationId,
      status,
      workHours,
      overtime
    };

    if (existingIndex !== -1) {
      attendance[existingIndex] = record;
    } else {
      attendance.push(record);
    }
    addedCount++;
  }
  saveData(ATTENDANCE_FILE, attendance);
  res.json({ success: true, added: addedCount, skipped: skippedCount });
});

// ============ AUTO CHECKOUT ============
function autoCheckout() {
  const today = new Date().toISOString().split('T')[0];
  
  attendance.forEach((record: any) => {
    if (record.date < today && !record.checkOut) {
      const loc = locations.find((l: any) => l.id === record.locationId);
      const workingHours = loc?.workingHours || 9;
      record.checkOut = new Date(new Date(record.checkIn).getTime() + workingHours * 60 * 60 * 1000).toISOString();
      record.isAutoCheckedOut = true;
      record.status = 'Full Day';
      record.workHours = workingHours;
      record.overtime = 0;
    }
  });
  saveData(ATTENDANCE_FILE, attendance);
}

setInterval(autoCheckout, 3600000);

// ============ VITE SERVER ============
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();