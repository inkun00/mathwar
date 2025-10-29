'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

/**
 * FirebaseProvider manages and provides Firebase service instances.
 * User state is handled by the useUser hook.
 */
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const contextValue = useMemo((): FirebaseContextState => ({
    firebaseApp,
    firestore,
    auth,
  }), [firebaseApp, firestore, auth]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services.
 * Throws error if used outside a FirebaseProvider.
 */
export const useFirebaseServices = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebaseServices must be used within a FirebaseProvider.');
  }
  return context;
};

/** Hook to access Firebase Auth instance. Throws if not available. */
export const useAuth = (): Auth => {
  const { auth } = useFirebaseServices();
  if (!auth) {
    throw new Error('Firebase Auth service is not available.');
  }
  return auth;
};

/** Hook to access Firestore instance. Throws if not available. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebaseServices();
  if (!firestore) {
    throw new Error('Firebase Firestore service is not available.');
  }
  return firestore;
};

/** Hook to access Firebase App instance. Throws if not available. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebaseServices();
  if (!firebaseApp) {
    throw new Error('Firebase App instance is not available.');
  }
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  // @ts-ignore
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}
