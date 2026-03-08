import { useState, useEffect, useCallback } from "react";
import { ref, onValue, set, onDisconnect, remove } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { AppUser, PresenceData } from "@/types/types";

export const usePresence = (docId: string, user: AppUser | null) => {
  const [activeUsers, setActiveUsers] = useState<Record<string, PresenceData>>({});

  useEffect(() => {
    if (!docId || !user) return;

    const presenceRef = ref(rtdb, `documents/${docId}/presence/${user.uid}`);
    const roomRef = ref(rtdb, `documents/${docId}/presence`);

    // 1. Mark user as online
    const userPresence: PresenceData = {
      uid: user.uid,
      displayName: user.displayName,
      cursorColor: user.cursorColor,
      activeCellId: null,
      lastActive: Date.now(),
    };
    
    set(presenceRef, userPresence);

    // 2. Remove user when they close the browser tab
    onDisconnect(presenceRef).remove();

    // 3. Listen to everyone else in the room
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setActiveUsers(snapshot.val());
      } else {
        setActiveUsers({});
      }
    });

    // Cleanup when component unmounts (user leaves the page naturally)
    return () => {
      remove(presenceRef);
      unsubscribe();
    };
  }, [docId, user]);

  // Function to broadcast when this user clicks a different cell
  const updateCursor = useCallback((cellId: string | null) => {
    if (!docId || !user) return;
    const cellRef = ref(rtdb, `documents/${docId}/presence/${user.uid}/activeCellId`);
    set(cellRef, cellId);
  }, [docId, user]);

  return { activeUsers, updateCursor };
};