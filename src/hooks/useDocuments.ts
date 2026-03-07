import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SpreadsheetDoc } from "@/types";

export const useDocuments = (uid: string | undefined) => {
  const [documents, setDocuments] = useState<SpreadsheetDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "spreadsheets"),
      where("ownerId", "==", uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SpreadsheetDoc[];
      setDocuments(docsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const createDocument = async () => {
    if (!uid) return null;
    try {
      const docRef = await addDoc(collection(db, "spreadsheets"), {
        title: "Untitled Spreadsheet",
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating document:", error);
      return null;
    }
  };

  return { documents, loading, createDocument };
};