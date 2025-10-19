'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase/provider'; // Use the provider-based hook

export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Hook for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * It safely handles cases where the auth service might not be ready.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => {
  const auth = useAuth();
  const [userAuthState, setUserAuthState] = useState<UserHookResult>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  useEffect(() => {
    // If auth instance isn't available, we can't check the user.
    // Set loading to false and user to null.
    if (!auth) {
      setUserAuthState({ user: null, isUserLoading: false, userError: null });
      return;
    }

    // Reset state and start listening when auth object becomes available.
    setUserAuthState({ user: null, isUserLoading: true, userError: null });

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        // Auth state determined
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => {
        // Auth listener error
        console.error("useUser: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    
    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [auth]); // Re-run effect if the auth instance changes

  return userAuthState;
};
