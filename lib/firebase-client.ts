import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase Web configuration is public; authorization is enforced by Auth and Rules.
// Keep static env references so Next.js can include these values in the client bundle.
export function firebaseClient() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error(
      'Thiếu cấu hình Firebase trong .env.local ở thư mục gốc. Kiểm tra .env.example và khởi động lại npm run dev.',
    );
  }
  const name = 'business-hub-next';
  const app = getApps().find((app) => app.name === name) ?? initializeApp(config, name);
  return { auth: getAuth(app), db: getFirestore(app) };
}
