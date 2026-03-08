import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
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
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowExportMenu(false);
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [showExportMenu]);

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
    <div className="flex items-center justify-between px-3 h-12 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/")} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-emerald-600" size={20} />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-sm font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-slate-300 focus:ring-0 rounded-md px-2 py-1 outline-none w-56 transition-colors"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Presence Avatars */}
        <div className="flex -space-x-1.5">
          {Object.values(activeUsers).map((activeUser) => (
            <div 
              key={activeUser.uid}
              title={activeUser.displayName}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold ring-2 ring-white shadow-sm"
              style={{ backgroundColor: activeUser.cursorColor }}
            >
              {activeUser.displayName.charAt(0)}
            </div>
          ))}
        </div>
        {/* WRITE-STATE INDICATOR */}
        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3 text-xs text-slate-400 min-w-[7.5rem]">
          {syncState === 'syncing' && (
            <><RefreshCw size={13} className="animate-spin text-blue-400" /> <span>Saving...</span></>
          )}
          {syncState === 'synced' && (
            <><Cloud size={13} className="text-emerald-500" /> <span>Saved</span></>
          )}
          {syncState === 'error' && (
            <><CloudOff size={13} className="text-red-400" /> <span className="text-red-500">Offline</span></>
          )}
        </div>

        {/* SHARE BUTTON */}
        <button 
          onClick={handleCopyLink}
          className={`flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-lg transition-all text-xs font-medium ${
            copied ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-neutral-900 text-white border border-transparent hover:bg-neutral-700"
          }`}
        >
          {copied ? <Check size={14} /> : <Link size={14} />}
          {copied ? "Link Copied!" : "Share"}
        </button>

        {/* EXPORT DROPDOWN */}
{/* EXPORT WRAPPER */}
        <div className="relative" ref={exportMenuRef}>
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 ml-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded transition hover:bg-slate-50 text-sm font-medium"
          >
            <Download size={16} />
            Export
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-1.5 w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-[150] py-1">
              <button onClick={() => { exportData(docId, title, 'csv'); setShowExportMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">.CSV (Excel)</button>
              <button onClick={() => { exportData(docId, title, 'tsv'); setShowExportMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">.TSV (Data)</button>
              <button onClick={() => { exportData(docId, title, 'json'); setShowExportMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">.JSON (Web)</button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}