import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyA2Q7Qkgy_73E-_ftJ0sv_w5cNcwt1QHyU",
  authDomain: "wekeyar-attendance-30b84.firebaseapp.com",
  databaseURL: "https://wekeyar-attendance-30b84-default-rtdb.firebaseio.com",
  projectId: "wekeyar-attendance-30b84",
  storageBucket: "wekeyar-attendance-30b84.firebasestorage.app",
  messagingSenderId: "18084926276",
  appId: "1:18084926276:web:d7a02633ac287826acbd11"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function initData() {
  console.log('🚀 Initializing Firebase with default data...');
  
  // Default locations
  const locations = {
    "LOC001": {
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
  };
  
  // Default users
  const users = {
    "admin": {
      employeeId: "admin",
      password: "admin123",
      name: "Admin User",
      role: "admin",
      status: "active",
      department: "IT",
      locationId: "LOC001"
    },
    "hr": {
      employeeId: "hr",
      password: "hr123",
      name: "HR Manager",
      role: "hr",
      status: "active",
      department: "HR",
      locationId: "LOC001"
    },
    "staff001": {
      employeeId: "staff001",
      password: "staff",
      name: "John Staff",
      role: "staff",
      status: "active",
      department: "Field Operations",
      locationId: "LOC001"
    }
  };
  
  // Save locations
  for (const [id, data] of Object.entries(locations)) {
    await set(ref(database, `locations/${id}`), data);
    console.log(`✅ Saved location: ${id} - ${data.name}`);
  }
  
  // Save users
  for (const [id, data] of Object.entries(users)) {
    await set(ref(database, `users/${id}`), data);
    console.log(`✅ Saved user: ${id} - ${data.name} (${data.role})`);
  }
  
  console.log('✨ Firebase initialization complete!');
  console.log('📊 You can now login with:');
  console.log('   Admin: admin / admin123');
  console.log('   HR: hr / hr123');
  console.log('   Staff: staff001 / staff');
}

initData().catch(console.error);