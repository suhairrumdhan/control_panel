const firebaseConfig = {
  apiKey: "AIzaSyAsn2tC0UirEnjPLSgVYvLNTGY1Z9GQoi0",
  authDomain: "pharma-apps.firebaseapp.com",
  projectId: "pharma-apps",
  storageBucket: "pharma-apps.firebasestorage.app",
  messagingSenderId: "657034913156",
  appId: "1:657034913156:web:6cf3497ff0d637328769d1",
  measurementId: "G-VTR79DH4ZH"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();