const firebaseConfig = {
  apiKey: "AIzaSyCQCxBsgiVNZhOu6A_0ZfqHZy7PHax5Gsc",
  authDomain: "myawesomefirebase6989.firebaseapp.com",
  databaseURL: "https://myawesomefirebase6989-default-rtdb.firebaseio.com",
  projectId: "myawesomefirebase6989",
  storageBucket: "myawesomefirebase6989.firebasestorage.app",
  messagingSenderId: "961508636587",
  appId: "1:961508636587:web:f0889acf07884f156f84ee",
  measurementId: "G-51NS9J3FX9"
};

let appPromise;
let authPromise;
let dbPromise;
let authModulePromise;
let firestoreModulePromise;

async function getFirebaseApp() {
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp }) => initializeApp(firebaseConfig));
  }
  return appPromise;
}

async function getAuthModule() {
  if (!authModulePromise) {
    authModulePromise = import('firebase/auth');
  }
  return authModulePromise;
}

async function getFirestoreModule() {
  if (!firestoreModulePromise) {
    firestoreModulePromise = import('firebase/firestore/lite');
  }
  return firestoreModulePromise;
}

export async function getAuthServices() {
  const [app, authModule] = await Promise.all([getFirebaseApp(), getAuthModule()]);
  if (!authPromise) {
    authPromise = Promise.resolve(authModule.getAuth(app));
  }
  const auth = await authPromise;
  const googleProvider = new authModule.GoogleAuthProvider();
  return { auth, googleProvider, authModule };
}

export async function getFirestoreServices() {
  const [app, firestoreModule] = await Promise.all([getFirebaseApp(), getFirestoreModule()]);
  if (!dbPromise) {
    dbPromise = Promise.resolve(firestoreModule.getFirestore(app));
  }
  const db = await dbPromise;
  return { db, firestoreModule };
}
