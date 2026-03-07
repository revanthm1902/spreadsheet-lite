import { useState, useEffect } from "react";
import { useGridSync } from "@/hooks/useGridSync";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence"; // <-- ADD THIS

const COLS = 26;
const ROWS = 100;
const getColumnName = (index: number) => String.fromCharCode(65 + index);

export default function Grid({ docId }: { docId: string }) {
  const { user } = useAuth();
  const { cells, updateCell } = useGridSync(docId, user?.uid);
  const { activeUsers, updateCursor } = usePresence(docId, user); // <-- ADD THIS
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

  // Broadcast cursor changes
  useEffect(() => {
    updateCursor(selectedCell);
  }, [selectedCell, updateCursor]);

  const handleCellChange = (cellId: string, value: string) => {
    updateCell(cellId, value);
  };

  return (
    <div className="w-full h-full overflow-auto bg-white relative">
      <table className="border-collapse table-fixed">
        {/* ... KEEP the thead exactly the same ... */}
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
                const cellValue = cells[cellId]?.value || "";

                // Look for another user occupying this cell
                const occupyingUser = Object.values(activeUsers).find(
                  (u) => u.uid !== user?.uid && u.activeCellId === cellId
                );

                return (
                  <td 
                    key={colIndex}
                    className="border-b border-r border-gray-200 relative p-0 cursor-cell"
                    onClick={() => setSelectedCell(cellId)}
                  >
                    {/* Render multiplayer colored border if occupied */}
                    {occupyingUser && (
                      <div 
                        className="absolute inset-0 z-10 pointer-events-none border-2" 
                        style={{ borderColor: occupyingUser.cursorColor }}
                      />
                    )}
                    
                    <input
                      type="text"
                      className={`w-full h-full min-h-[28px] px-1 outline-none text-sm ${
                        isSelected ? "ring-2 ring-blue-500 z-20 relative bg-white" : "bg-transparent relative z-0"
                      }`}
                      value={cellValue}
                      onChange={(e) => handleCellChange(cellId, e.target.value)}
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