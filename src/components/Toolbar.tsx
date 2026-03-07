import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { SpreadsheetDoc } from "@/types";

interface ToolbarProps {
  document: SpreadsheetDoc;
  updateTitle: (title: string) => void;
}

export default function Toolbar({ document, updateTitle }: ToolbarProps) {
  const router = useRouter();
  const [title, setTitle] = useState(document.title);

  // Sync local state if remote title changes
  useEffect(() => {
    setTitle(document.title);
  }, [document.title]);

  const handleTitleBlur = () => {
    if (title.trim() !== document.title && title.trim() !== "") {
      updateTitle(title);
    } else {
      setTitle(document.title); // reset if empty
    }
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-white shadow-sm">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.push("/")}
          className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
          title="Back to Dashboard"
        >
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
        {/* We will add the Presence Avatars and Save Indicator here later */}
        <span className="text-sm text-gray-500">Saved to cloud</span>
      </div>
    </div>
  );
}