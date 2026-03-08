import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, FileSpreadsheet, Cloud, CloudOff, RefreshCw, Download, Link, Check } from "lucide-react";
import { SpreadsheetDoc } from "@/types/types";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { SyncState } from "@/hooks/useGridSync";
import { exportData } from "@/lib/export";

interface ToolbarProps {
  document: SpreadsheetDoc;
  updateTitle: (title: string) => void;
  docId: string;
  syncState: SyncState;
}

export default function Toolbar({ document, updateTitle, docId, syncState }: ToolbarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeUsers } = usePresence(docId, user);
  const [title, setTitle] = useState(document.title);
  const [prevDocTitle, setPrevDocTitle] = useState(document.title);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  if (document.title !== prevDocTitle) {
    setPrevDocTitle(document.title);
    setTitle(document.title);
  
  }

  const handleTitleBlur = () => {
    if (title.trim() !== document.title && title.trim() !== "") {
      updateTitle(title);
    } else {
      setTitle(document.title);
    }
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-white shadow-sm">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/")} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-green-600" size={24} />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-lg font-medium text-gray-800 bg-transparent border-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1 outline-none w-64"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Presence Avatars */}
        <div className="flex -space-x-2">
          {Object.values(activeUsers).map((activeUser) => (
            <div 
              key={activeUser.uid}
              title={activeUser.displayName}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-white shadow-sm"
              style={{ backgroundColor: activeUser.cursorColor }}
            >
              {activeUser.displayName.charAt(0)}
            </div>
          ))}
        </div>
        {/* WRITE-STATE INDICATOR */}
        <div className="flex items-center gap-2 border-l pl-4 text-sm text-gray-500 min-w-30">
          {syncState === 'syncing' && (
            <><RefreshCw size={16} className="animate-spin text-blue-500" /> <span>Saving...</span></>
          )}
          {syncState === 'synced' && (
            <><Cloud size={16} className="text-green-600" /> <span>Saved to cloud</span></>
          )}
          {syncState === 'error' && (
            <><CloudOff size={16} className="text-red-500" /> <span className="text-red-500">Offline</span></>
          )}
        </div>

        {/* SHARE BUTTON */}
        <button 
          onClick={handleCopyLink}
          className={`flex items-center gap-2 ml-4 px-3 py-1.5 rounded transition text-sm font-medium border ${
            copied ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          }`}
        >
          {copied ? <Check size={16} /> : <Link size={16} />}
          {copied ? "Link Copied!" : "Share"}
        </button>

        {/* EXPORT DROPDOWN */}
        <div className="relative">
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 ml-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition text-sm font-medium border"
          >
            <Download size={16} />
            Export
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-1 w-32 bg-white border rounded shadow-lg z-50 overflow-hidden">
              <button 
                onClick={() => { exportData(docId, title, 'csv'); setShowExportMenu(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition"
              >
                .CSV (Excel)
              </button>
              <button 
                onClick={() => { exportData(docId, title, 'tsv'); setShowExportMenu(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition"
              >
                .TSV (Data)
              </button>
              <button 
                onClick={() => { exportData(docId, title, 'json'); setShowExportMenu(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition"
              >
                .JSON (Web)
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}