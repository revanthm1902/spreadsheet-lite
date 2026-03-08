"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDocument } from "@/hooks/useDocument";
import Toolbar from "@/components/Toolbar";
import Grid from "@/components/Grid";
import { SyncState } from "@/hooks/useGridSync";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";

export default function SpreadsheetEditor() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const { user, loading: authLoading } = useAuth();
  const { document, loading: docLoading, updateTitle } = useDocument(docId);

  const [syncState, setSyncState] = useState<SyncState>('synced');

  // Protect the route: if not logged in, boot them to home
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  if (authLoading || docLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading editor...</div>;
  }

  if (!document) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Document not found</h2>
        <button onClick={() => router.push("/")} className="text-blue-600 hover:underline">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleRename = async (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.preventDefault(); // Prevents navigating to the spreadsheet
    const newTitle = window.prompt("Enter new spreadsheet name:", currentTitle);
    
    if (newTitle && newTitle.trim() !== "" && newTitle !== currentTitle) {
      try {
        await updateDoc(doc(db, "spreadsheets", id), {
          title: newTitle.trim()
        });
      } catch (error) {
        console.error("Error renaming document:", error);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevents navigating to the spreadsheet
    if (window.confirm("Are you sure you want to delete this spreadsheet? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "spreadsheets", id));
      } catch (error) {
        console.error("Error deleting document:", error);
      }
    }
  };

return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Pass syncState to Toolbar */}
      <Toolbar document={document} updateTitle={updateTitle} docId={docId} syncState={syncState} />
      
      <main className="flex-1 overflow-hidden bg-white m-2 border rounded shadow-sm">
        {/* Pass setSyncState to Grid */}
        <Grid docId={docId} setSyncState={setSyncState} />
      </main>
    </div>
  );
}