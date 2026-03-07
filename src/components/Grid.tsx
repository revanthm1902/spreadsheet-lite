import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGridSync, SyncState } from "@/hooks/useGridSync";
import { usePresence } from "@/hooks/usePresence";
import { evaluateFormula } from "@/lib/formula";

const COLS = 26;
const ROWS = 100;
const getColumnName = (index: number) => String.fromCharCode(65 + index);

interface GridProps {
  docId: string;
  setSyncState: (state: SyncState) => void;
}

export default function Grid({ docId, setSyncState }: GridProps){
  const { user } = useAuth();
  const { cells, updateCell } = useGridSync(docId, user?.uid, setSyncState);
  const { activeUsers, updateCursor } = usePresence(docId, user);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null); // Track if user is actively typing

  useEffect(() => {
    updateCursor(selectedCell);
  }, [selectedCell, updateCursor]);

  return (
    <div className="w-full h-full overflow-auto bg-white relative">
      <table className="border-collapse table-fixed">
        {/* ... KEEP thead exactly the same ... */}
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 w-12 h-8 bg-gray-100 border-b border-r border-gray-300"></th>
            {Array.from({ length: COLS }).map((_, colIndex) => (
              <th key={colIndex} className="sticky top-0 z-20 w-28 h-8 bg-gray-100 border-b border-r border-gray-300 font-normal text-sm text-gray-600 text-center select-none">
                {getColumnName(colIndex)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              <td className="sticky left-0 z-20 bg-gray-100 border-b border-r border-gray-300 text-center text-sm text-gray-600 select-none w-12">
                {rowIndex + 1}
              </td>
              {Array.from({ length: COLS }).map((_, colIndex) => {
                const cellId = `${getColumnName(colIndex)}${rowIndex + 1}`;
                const isSelected = selectedCell === cellId;
                const isEditing = editingCell === cellId;
                
                const rawValue = cells[cellId]?.value || "";
                // Calculate display value on the fly
                const displayValue = isEditing ? rawValue : evaluateFormula(rawValue, cells);

                const occupyingUser = Object.values(activeUsers).find(
                  (u) => u.uid !== user?.uid && u.activeCellId === cellId
                );

                return (
                  <td 
                    key={colIndex}
                    className="border-b border-r border-gray-200 relative p-0 cursor-cell"
                    onClick={() => {
                      setSelectedCell(cellId);
                      if (!isEditing) setEditingCell(cellId);
                    }}
                  >
                    {occupyingUser && (
                      <div className="absolute inset-0 z-10 pointer-events-none border-2" style={{ borderColor: occupyingUser.cursorColor }} />
                    )}
                    
                    <input
                      type="text"
                      className={`w-full h-full min-h-7 px-1 outline-none text-sm ${
                        isSelected ? "ring-2 ring-blue-500 z-20 relative bg-white" : "bg-transparent relative z-0"
                      }`}
                      value={displayValue}
                      onChange={(e) => updateCell(cellId, e.target.value)}
                      onFocus={() => setEditingCell(cellId)}
                      onBlur={() => setEditingCell(null)} // Switch back to computed value when clicking away
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}