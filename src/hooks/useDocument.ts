import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SpreadsheetDoc } from "@/types/types";

export const useDocument = (docId: string) => {
  const [document, setDocument] = useState<SpreadsheetDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;

    const docRef = doc(db, "spreadsheets", docId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setDocument({ id: docSnap.id, ...docSnap.data() } as SpreadsheetDoc);
      } else {
        setDocument(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [docId]);

  const updateTitle = async (newTitle: string) => {
    if (!docId) return;
    const docRef = doc(db, "spreadsheets", docId);
    await updateDoc(docRef, { title: newTitle });
  };

  return { document, loading, updateTitle };
};