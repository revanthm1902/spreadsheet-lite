import { useState, useEffect, useCallback } from "react";
import { ref, onValue, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export const useGridSync = (docId: string, uid: string | undefined) => {
  // We store cells as a dictionary/object keyed by cell ID (e.g., { "A1": { value: "Hello" } })
  const [cells, setCells] = useState<Record<string, { value: string }>>({});

  // Listen for changes from Firebase
  useEffect(() => {
    if (!docId) return;
    
    const cellsRef = ref(rtdb, `documents/${docId}/cells`);
    const unsubscribe = onValue(cellsRef, (snapshot) => {
      if (snapshot.exists()) {
        setCells(snapshot.val());
      } else {
        setCells({});
      }
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [docId]);

  // Push changes to Firebase
  const updateCell = useCallback((cellId: string, value: string) => {
    if (!docId || !uid) return;

    // Optimistic local update for a snappy UI before the server responds
    setCells((prev) => ({
      ...prev,
      [cellId]: { ...prev[cellId], value }
    }));

    // Update RTDB
    const cellRef = ref(rtdb, `documents/${docId}/cells`);
    update(cellRef, {
      [`${cellId}/value`]: value,
      [`${cellId}/lastModifiedBy`]: uid,
      [`${cellId}/timestamp`]: Date.now(),
    });
  }, [docId, uid]);

  return { cells, updateCell };
};