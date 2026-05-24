import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, query, orderByChild, equalTo, onValue } from 'firebase/database';

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

console.log('🔥 Firebase Connected!');

export async function getAllFromCollection<T>(collectionPath: string): Promise<T[]> {
  const snapshot = await get(ref(database, collectionPath));
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.keys(data).map(key => ({ id: key, ...data[key] })) as T[];
}

export async function getFromCollection<T>(collectionPath: string, id: string): Promise<T | null> {
  const snapshot = await get(ref(database, `${collectionPath}/${id}`));
  if (!snapshot.exists()) return null;
  return { id, ...snapshot.val() } as T;
}

export async function saveToCollection<T>(collectionPath: string, id: string, data: any): Promise<T> {
  await set(ref(database, `${collectionPath}/${id}`), { ...data, id });
  return { ...data, id } as T;
}

export async function updateInCollection(collectionPath: string, id: string, data: any): Promise<void> {
  await update(ref(database, `${collectionPath}/${id}`), data);
}

export async function deleteFromCollection(collectionPath: string, id: string): Promise<void> {
  await remove(ref(database, `${collectionPath}/${id}`));
}

export { database };