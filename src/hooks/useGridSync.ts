import { useState, useEffect, useCallback } from "react";
import { ref, onValue, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export type SyncState = 'synced' | 'syncing' | 'error'; // Add this type

export const useGridSync = (
  docId: string, 
  uid: string | undefined, 
  setSyncState: (state: SyncState) => void // Pass the state setter in
) => {
  const [cells, setCells] = useState<Record<string, { value: string }>>({});

  useEffect(() => {
    if (!docId) return;
    const cellsRef = ref(rtdb, `documents/${docId}/cells`);
    const unsubscribe = onValue(cellsRef, (snapshot) => {
      if (snapshot.exists()) setCells(snapshot.val());
      else setCells({});
    });
    return () => unsubscribe();
  }, [docId]);

  const updateCell = useCallback(async (cellId: string, value: string) => {
    if (!docId || !uid) return;

    // Optimistic local update so UI doesn't lag
    setCells((prev) => ({
      ...prev,
      [cellId]: { ...prev[cellId], value }
    }));

    setSyncState('syncing'); // Trigger "Saving..."

    const cellRef = ref(rtdb, `documents/${docId}/cells`);
    try {
      await update(cellRef, {
        [`${cellId}/value`]: value,
        [`${cellId}/lastModifiedBy`]: uid,
        [`${cellId}/timestamp`]: Date.now(),
      });
      setSyncState('synced'); // Trigger "Saved"
    } catch (error) {
      console.error("Firebase Write Error:", error);
      setSyncState('error'); // Trigger "Error"
    }
  }, [docId, uid, setSyncState]);

  return { cells, updateCell };
};