// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { Platform } from 'react-native'; 
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../services/firebase';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [savedArticles, setSavedArticles] = useState([]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      GoogleSignin.configure({
        webClientId: '655643804828-qv877hhflaf40g6mt9u5mhdta7rvllju.apps.googleusercontent.com',
      });
    }

    if (!auth) {
      console.error("Firebase auth is missing! Check firebase.js");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists() && docSnap.data().savedArticles) {
            setSavedArticles(docSnap.data().savedArticles);
          }
        });
      } else {
        const localSaved = await AsyncStorage.getItem('@guest_saved_news');
        if (localSaved) setSavedArticles(JSON.parse(localSaved));
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      let userCredential;

      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        userCredential = await signInWithPopup(auth, provider);
      } else {
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();
        
        // 🔴 મેજિક અહીં છે: નવા અને જૂના બન્ને વર્ઝન માટે Token કાઢવાની સાચી રીત
        const idToken = response.data?.idToken || response.idToken;
        
        if (!idToken) {
           throw new Error("Google તરફથી Token નથી મળ્યો!");
        }

        const googleCredential = GoogleAuthProvider.credential(idToken);
        userCredential = await signInWithCredential(auth, googleCredential);
      }
      
      const uid = userCredential.user.uid;
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      const localSaved = await AsyncStorage.getItem('@guest_saved_news');
      let combinedArticles = localSaved ? JSON.parse(localSaved) : [];

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: userCredential.user.email,
          displayName: userCredential.user.displayName || userCredential.user.email.split('@')[0],
          photoURL: userCredential.user.photoURL || '',
          createdAt: new Date(),
          savedArticles: combinedArticles
        });
      } else {
        const cloudArticles = userDoc.data().savedArticles || [];
        combinedArticles = [...cloudArticles, ...combinedArticles.filter(la => !cloudArticles.find(ca => ca.id === la.id))];
        await setDoc(userDocRef, { savedArticles: combinedArticles }, { merge: true });
      }
      
      await AsyncStorage.removeItem('@guest_saved_news');
      return true;
    } catch (error) {
      console.error(error);
      alert("Login Failed: " + error.message);
      return false;
    }
  };

  const toggleSave = async (article) => {
    const isSaved = savedArticles.find(a => a.id === article.id);
    const newSaved = isSaved ? savedArticles.filter(a => a.id !== article.id) : [...savedArticles, article];
    
    setSavedArticles(newSaved);

    if (user) {
      await setDoc(doc(db, 'users', user.uid), { savedArticles: newSaved }, { merge: true });
    } else {
      await AsyncStorage.setItem('@guest_saved_news', JSON.stringify(newSaved));
    }
  };

  const logout = async () => {
    await signOut(auth);
    setSavedArticles([]);
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signInWithGoogle, logout, savedArticles, toggleSave }}>
      {children}
    </AuthContext.Provider>
  );
};