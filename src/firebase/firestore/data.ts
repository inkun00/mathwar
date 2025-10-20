'use client';

import {
  Firestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import type { MathProblem } from '@/lib/types';
import { problemNodeToString } from '@/lib/game-logic';

/**
 * Adds a problem to the user's wrong answer collection.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the user.
 * @param problem - The MathProblem object that was answered incorrectly.
 */
export const addWrongAnswer = async (
  firestore: Firestore,
  userId: string,
  problem: MathProblem
): Promise<void> => {
  try {
    // Save to the 'wrong_answers' subcollection under the specific user
    await addDoc(collection(firestore, 'users', userId, 'wrong_answers'), {
      userId: userId,
      problemData: problem.storable,
      problemString: problemNodeToString(problem.problem),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding wrong answer:', error);
    // Optionally, you could use a global error handler or toast here
  }
};

/**
 * Deletes a problem from the user's wrong answer collection.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the user.
 * @param wrongAnswerId - The ID of the wrong answer document to delete.
 */
export const deleteWrongAnswer = async (
  firestore: Firestore,
  userId: string,
  wrongAnswerId: string
): Promise<void> => {
  try {
    // Delete from the 'wrong_answers' subcollection under the specific user
    await deleteDoc(doc(firestore, 'users', userId, 'wrong_answers', wrongAnswerId));
  } catch (error) {
    console.error('Error deleting wrong answer:', error);
  }
};
