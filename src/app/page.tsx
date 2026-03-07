"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDocuments } from "@/hooks/useDocuments";
import Navbar from "@/components/Navbar";
import { Plus, FileText } from "lucide-react";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { documents, loading: docsLoading, createDocument } = useDocuments(user?.uid);
  const router = useRouter();

  const handleCreateNew = async () => {
    const newDocId = await createDocument();
    if (newDocId) {
      router.push(`/sheet/${newDocId}`);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-6xl mx-auto p-6">
        {!user ? (
          <div className="text-center mt-20">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to SheetsLite</h1>
            <p className="text-gray-600">Sign in to start creating and collaborating on spreadsheets.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-8 mt-4">
              <h2 className="text-2xl font-semibold text-gray-800">Recent Documents</h2>
              <button 
                onClick={handleCreateNew}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition shadow-sm"
              >
                <Plus size={20} />
                Blank Spreadsheet
              </button>
            </div>

            {docsLoading ? (
              <p>Loading documents...</p>
            ) : documents.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                <p className="text-gray-500">No documents yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    onClick={() => router.push(`/sheet/${doc.id}`)}
                    className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md hover:border-green-300 transition cursor-pointer flex flex-col gap-3"
                  >
                    <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                      <FileText size={48} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 truncate">{doc.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {doc.updatedAt ? new Date(doc.updatedAt.toMillis()).toLocaleDateString() : 'Just now'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}