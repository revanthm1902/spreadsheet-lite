import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, FileSpreadsheet, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { SpreadsheetDoc } from "@/types/types";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { SyncState } from "@/hooks/useGridSync";

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

      </div>
    </div>
  );
}