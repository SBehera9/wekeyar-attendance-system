// API Serverless Function for Vercel
let users = [
  { employeeId: "admin", password: "admin123", name: "Admin", role: "admin", status: "active", department: "IT", locationId: "LOC001" },
  { employeeId: "hr", password: "hr123", name: "HR Manager", role: "hr", status: "active", department: "HR", locationId: "LOC001" },
  { employeeId: "staff001", password: "staff", name: "John Staff", role: "staff", status: "active", department: "Field", locationId: "LOC001" }
];

let locations = [
  { id: "LOC001", name: "Main Office", type: "Office", latitude: 28.6139, longitude: 77.2090, radius: 500, breakTime: 60, workingHours: 9, weeklyOffDay: "Sunday", status: "active" }
];

let attendance = [];
let leaves = [];
let sessions = {};

export default async function handler(req, res) {
  const { url, method, body } = req;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // ============ LOGIN ============
  if (url === '/api/auth/login' && method === 'POST') {
    const { employeeId, password, deviceId } = body;
    const user = users.find(u => u.employeeId === employeeId && u.password === password);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    sessions[employeeId] = deviceId;
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ user: userWithoutPassword, sessionId: deviceId });
  }

  // ============ SESSION CHECK ============
  if (url === '/api/auth/session-check' && method === 'POST') {
    const { employeeId, sessionId } = body;
    if (sessions[employeeId] !== sessionId) {
      return res.status(401).json({ error: "Session expired" });
    }
    return res.json({ status: "ok" });
  }

  // ============ VERIFY PASSWORD ============
  if (url === '/api/auth/verify-password' && method === 'POST') {
    const { employeeId, password } = body;
    const user = users.find(u => u.employeeId === employeeId && u.password === password);
    return res.json({ valid: !!user });
  }

  // ============ GET LOCATIONS ============
  if (url === '/api/locations' && method === 'GET') {
    return res.json(locations);
  }

  // ============ ADD LOCATION ============
  if (url === '/api/locations' && method === 'POST') {
    const newLoc = { ...body, id: body.id || `LOC${Date.now()}` };
    locations.push(newLoc);
    return res.json(newLoc);
  }

  // ============ UPDATE LOCATION ============
  if (url && url.startsWith('/api/locations/') && method === 'PATCH') {
    const id = url.split('/')[3];
    const index = locations.findIndex(l => l.id === id);
    if (index === -1) return res.status(404).json({ error: "Location not found" });
    locations[index] = { ...locations[index], ...body };
    return res.json(locations[index]);
  }

  // ============ DELETE LOCATION ============
  if (url && url.startsWith('/api/locations/') && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = locations.findIndex(l => l.id === id);
    if (index === -1) return res.status(404).json({ error: "Location not found" });
    locations.splice(index, 1);
    return res.status(204).send();
  }

  // ============ GET EMPLOYEES ============
  if (url === '/api/employees' && method === 'GET') {
    const employeesWithoutPassword = users.map(({ password, ...u }) => u);
    return res.json(employeesWithoutPassword);
  }

  // ============ ADD EMPLOYEE ============
  if (url === '/api/employees' && method === 'POST') {
    const { employeeId } = body;
    if (users.find(u => u.employeeId === employeeId)) {
      return res.status(400).json({ error: "Employee ID already exists" });
    }
    const newUser = { ...body, status: body.status || "active" };
    users.push(newUser);
    const { password, ...userWithoutPassword } = newUser;
    return res.json(userWithoutPassword);
  }

  // ============ UPDATE EMPLOYEE ============
  if (url && url.startsWith('/api/employees/') && method === 'PATCH' && !url.includes('/reset-bind')) {
    const id = url.split('/')[3];
    const index = users.findIndex(u => u.employeeId === id);
    if (index === -1) return res.status(404).json({ error: "Employee not found" });
    users[index] = { ...users[index], ...body };
    const { password, ...userWithoutPassword } = users[index];
    return res.json(userWithoutPassword);
  }

  // ============ RESET DEVICE BIND ============
  if (url && url.includes('/reset-bind') && method === 'PATCH') {
    const id = url.split('/')[3];
    const index = users.findIndex(u => u.employeeId === id);
    if (index === -1) return res.status(404).json({ error: "Employee not found" });
    users[index].mobileBound = false;
    users[index].deviceId = "";
    delete sessions[id];
    return res.json({ status: "ok" });
  }

  // ============ DELETE EMPLOYEE ============
  if (url && url.startsWith('/api/employees/') && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = users.findIndex(u => u.employeeId === id);
    if (index === -1) return res.status(404).json({ error: "Employee not found" });
    users.splice(index, 1);
    return res.status(204).send();
  }

  // ============ GET ATTENDANCE ============
  if (url === '/api/attendance' && method === 'GET') {
    return res.json(attendance);
  }

  // ============ GET TODAY'S ATTENDANCE ============
  if (url === '/api/attendance/today' && method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendance.filter(a => a.date === today);
    return res.json(todayRecords);
  }

  // ============ PUNCH IN/OUT ============
  if (url === '/api/attendance/punch' && method === 'POST') {
    const { employeeId, type, locationId, timestamp } = body;
    const date = new Date(timestamp).toISOString().split('T')[0];
    
    let record = attendance.find(a => a.employeeId === employeeId && a.date === date);
    
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
      record[type] = timestamp;
    }
    return res.json(record);
  }

  // ============ EDIT ATTENDANCE ============
  if (url && url.startsWith('/api/attendance/') && method === 'PATCH') {
    const id = url.split('/')[3];
    const index = attendance.findIndex(a => a.id === id);
    if (index === -1) return res.status(404).json({ error: "Attendance record not found" });
    attendance[index] = { ...attendance[index], ...body.updates };
    return res.json(attendance[index]);
  }

  // ============ GET LEAVES ============
  if (url === '/api/leaves' && method === 'GET') {
    return res.json(leaves);
  }

  // ============ APPLY LEAVE ============
  if (url === '/api/leaves' && method === 'POST') {
    const newLeave = {
      id: `LEV${Date.now()}`,
      ...body,
      status: 'Pending Leave',
      appliedAt: new Date().toISOString()
    };
    leaves.push(newLeave);
    return res.json(newLeave);
  }

  // ============ PROCESS LEAVE ============
  if (url && url.startsWith('/api/leaves/') && method === 'PATCH') {
    const id = url.split('/')[3];
    const index = leaves.findIndex(l => l.id === id);
    if (index === -1) return res.status(404).json({ error: "Leave request not found" });
    leaves[index] = { ...leaves[index], ...body };
    return res.json(leaves[index]);
  }

  // ============ BULK IMPORT EMPLOYEES ============
  if (url === '/api/employees/bulk-import' && method === 'POST') {
    let added = 0;
    for (const item of body) {
      if (item.employeeId && !users.find(u => u.employeeId === item.employeeId)) {
        users.push({ ...item, status: "active" });
        added++;
      }
    }
    return res.json({ success: true, added, skipped: 0 });
  }

  // ============ BULK IMPORT ATTENDANCE ============
  if (url === '/api/attendance/bulk-import' && method === 'POST') {
    let added = 0;
    for (const item of body) {
      attendance.push({ ...item, id: `ATT${Date.now()}_${added}` });
      added++;
    }
    return res.json({ success: true, added, skipped: 0 });
  }

  // ============ AUDIT LOGS ============
  if (url === '/api/audit-logs' && method === 'GET') {
    return res.json([]);
  }

  // ============ 404 ============
  return res.status(404).json({ error: "API endpoint not found" });
}