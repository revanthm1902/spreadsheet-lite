import { useState, useEffect, useCallback } from "react";
import { ref, onValue, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { CellData } from "@/types/types";

export type SyncState = 'synced' | 'syncing' | 'error';

export const useGridSync = (docId: string, uid: string | undefined, setSyncState: (state: SyncState) => void) => {
  const [cells, setCells] = useState<Record<string, CellData>>({});

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
    setSyncState('syncing');
    setCells((prev) => ({ ...prev, [cellId]: { ...prev[cellId], value } as CellData }));

    try {
      await update(ref(rtdb, `documents/${docId}/cells`), {
        [`${cellId}/value`]: value,
        [`${cellId}/lastModifiedBy`]: uid,
        [`${cellId}/timestamp`]: Date.now(),
      });
      setSyncState('synced');
    } catch (error) {
      setSyncState('error');
    }
  }, [docId, uid, setSyncState]);

  // --- BATCH FORMAT UPDATE ---
  const updateFormat = useCallback(async (cellIds: string[], format: Partial<CellData>) => {
    if (!docId || !uid || cellIds.length === 0) return;
    setSyncState('syncing');

    // Optimistic local update for instant UI response
    setCells((prev) => {
      const next = { ...prev };
      cellIds.forEach(id => {
        next[id] = { ...next[id], ...format, value: next[id]?.value || "" } as CellData;
      });
      return next;
    });

    const updates: Record<string, any> = {};
    cellIds.forEach(id => {
      if (format.bold !== undefined) updates[`${id}/bold`] = format.bold;
      if (format.italic !== undefined) updates[`${id}/italic`] = format.italic;
      if (format.textColor !== undefined) updates[`${id}/textColor`] = format.textColor;
      if (format.backgroundColor !== undefined) updates[`${id}/backgroundColor`] = format.backgroundColor;
      if (format.fontFamily !== undefined) updates[`${id}/fontFamily`] = format.fontFamily;
      updates[`${id}/lastModifiedBy`] = uid;
      updates[`${id}/timestamp`] = Date.now();
    });

    try {
      await update(ref(rtdb, `documents/${docId}/cells`), updates);
      setSyncState('synced');
    } catch (error) {
      setSyncState('error');
    }
  }, [docId, uid, setSyncState]);

  return { cells, updateCell, updateFormat };
};