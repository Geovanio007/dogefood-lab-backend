import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDPDYvwWVhmnTTAcACEdI1agLQcetDV9jQ",
  authDomain: "dogefood-lab.firebaseapp.com",
  projectId: "dogefood-lab",
  storageBucket: "dogefood-lab.appspot.com",
  messagingSenderId: "",
  appId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
export default app;
