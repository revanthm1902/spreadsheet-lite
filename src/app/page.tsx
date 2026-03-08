"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDocuments } from "@/hooks/useDocuments";
import Navbar from "@/components/Navbar";
import { Plus, FileSpreadsheet, LogIn, Edit2, Trash2 } from "lucide-react";
import { doc, deleteDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const formatDate = (ts: Timestamp) => {
  if (!ts) return "Just now";
  return new Date(ts.toMillis()).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden animate-pulse">
      <div className="h-36 bg-neutral-100" />
      <div className="p-4 space-y-2">
        <div className="h-3.5 bg-neutral-200 rounded-full w-3/4" />
        <div className="h-3 bg-neutral-100 rounded-full w-1/2" />
      </div>
    </div>
  );
}

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

  const handleRename = async (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
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
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this spreadsheet? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "spreadsheets", id));
      } catch (error) {
        console.error("Error deleting document:", error);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
          <FileSpreadsheet className="text-white" size={22} />
        </div>
        <div className="flex flex-col items-center gap-2 w-44">
          <div className="h-2.5 bg-neutral-200 rounded-full w-full animate-pulse" />
          <div className="h-2.5 bg-neutral-200 rounded-full w-2/3 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {!user ? (
          <div className="flex flex-col items-center justify-center text-center pt-24 pb-16">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 mb-6">
              <FileSpreadsheet className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight mb-3">
              Welcome to SheetsLite
            </h1>
            <p className="text-neutral-500 text-base max-w-sm mb-8">
              Sign in to start creating and collaborating on spreadsheets.
            </p>
            <div className="flex items-center gap-2 text-sm text-neutral-400 border border-neutral-200 rounded-lg px-4 py-2.5 bg-white">
              <LogIn size={14} />
              Use the Sign in button in the top-right corner
            </div>
          </div>
        ) : (
          <>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">My Spreadsheets</h2>
                <p className="text-sm text-neutral-400 mt-0.5">
                  {docsLoading
                    ? "Loading..."
                    : `${documents.length} document${documents.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-200/60 transition-all duration-150"
              >
                <Plus size={16} />
                New Spreadsheet
              </button>
            </div>

            {/* Loading Skeleton */}
            {docsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : documents.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center text-center py-24 rounded-2xl border border-dashed border-neutral-300 bg-white">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-4">
                  <FileSpreadsheet size={22} className="text-neutral-400" />
                </div>
                <h3 className="text-base font-semibold text-neutral-700 mb-1">No spreadsheets yet</h3>
                <p className="text-sm text-neutral-400 mb-6 max-w-xs">
                  Create your first spreadsheet and start organizing your data.
                </p>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150"
                >
                  <Plus size={15} />
                  Create blank spreadsheet
                </button>
              </div>
            ) : (
              /* Document Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => router.push(`/sheet/${doc.id}`)}
                    className="group rounded-xl border border-neutral-200 bg-white overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-neutral-200/80 hover:border-emerald-200 transition-all duration-200"
                  >
                    {/* Spreadsheet grid preview */}
                    <div
                      className="h-36 flex items-center justify-center border-b border-neutral-100"
                      style={{
                        backgroundImage:
                          "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(to right, #e5e7eb 1px, transparent 1px)",
                        backgroundSize: "18px 18px",
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 shadow-sm flex items-center justify-center group-hover:border-emerald-300 group-hover:shadow-emerald-100 transition-all duration-200">
                        <FileSpreadsheet size={19} className="text-emerald-600" />
                      </div>
                    </div>
                    {/* Card info */}
                    <div className="px-4 py-3.5 flex justify-between items-start">
                      <div className="min-w-0 pr-2">
                        <h3 className="text-sm font-medium text-neutral-900 truncate">{doc.title}</h3>
                        <p className="text-xs text-neutral-400 mt-1">
                          {doc.updatedAt ? `Edited ${formatDate(doc.updatedAt)}` : "Just now"}
                        </p>
                      </div>
                      
                      {/* Action Buttons (Visible on hover) */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button 
                          onClick={(e) => handleRename(e, doc.id, doc.title)}
                          className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Rename"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, doc.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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