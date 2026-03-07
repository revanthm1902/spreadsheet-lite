"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDocument } from "@/hooks/useDocument";
import Toolbar from "@/components/Toolbar";
import Grid from "@/components/Grid";

export default function SpreadsheetEditor() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const { user, loading: authLoading } = useAuth();
  const { document, loading: docLoading, updateTitle } = useDocument(docId);

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

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <Toolbar document={document} updateTitle={updateTitle} />
      
      <main className="flex-1 overflow-auto bg-white m-2 border rounded shadow-sm">
        <main className="flex-1 overflow-hidden bg-white m-2 border rounded shadow-sm">
          <Grid docId={docId} />
        </main>
        <div className="flex items-center justify-center h-full text-gray-400">
          Grid Layout Placeholder
        </div>
      </main>
    </div>
  );
}