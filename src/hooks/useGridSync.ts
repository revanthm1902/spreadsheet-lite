import { useState, useEffect, useCallback } from "react";
import { ref, onValue, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export const useGridSync = (docId: string, uid: string | undefined) => {
  const [cells, setCells] = useState<Record<string, { value: string }>>({});

  useEffect(() => {
    if (!docId) return;
    
    const cellsRef = ref(rtdb, `documents/${docId}/cells`);
    
    // Add error handling to the listener
    const unsubscribe = onValue(cellsRef, (snapshot) => {
      if (snapshot.exists()) {
        setCells(snapshot.val());
      } else {
        setCells({});
      }
    }, (error) => {
      console.error("Firebase Read Error:", error);
    });

    return () => unsubscribe();
  }, [docId]);

  const updateCell = useCallback((cellId: string, value: string) => {
    if (!docId || !uid) {
      console.warn("Update blocked: Missing docId or User UID");
      return;
    }

    // Optimistic local update
    setCells((prev) => ({
      ...prev,
      [cellId]: { ...prev[cellId], value }
    }));

    const cellRef = ref(rtdb, `documents/${docId}/cells`);
    
    // Add catch block to see why writes are failing
    update(cellRef, {
      [`${cellId}/value`]: value,
      [`${cellId}/lastModifiedBy`]: uid,
      [`${cellId}/timestamp`]: Date.now(),
    }).catch((error) => {
      console.error("Firebase Write Error:", error);
    });
    
  }, [docId, uid]);

  return { cells, updateCell };
};