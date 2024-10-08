// src/Services/Firebase.js
import firebase from '@react-native-firebase/app';
import database from '@react-native-firebase/database';
import firestore from '@react-native-firebase/firestore';


const firebaseConfig = {
  apiKey: "AIzaSyA8ScivnvhBtQzFfz_OTJivmKRfTp_NnyM",
  authDomain: "random-58be6.firebaseapp.com",
  databaseURL: "https://random-58be6-default-rtdb.firebaseio.com",
  projectId: "random-58be6",
  storageBucket: "random-58be6.appspot.com",
  messagingSenderId: "994007531432",
  appId: "1:994007531432:web:e7d8a8c2ca0b863c1da79d",
  measurementId: "G-Q01T9EXGKQ"
};



if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export { database,firestore };