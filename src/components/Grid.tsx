import { useState } from "react";
import { useGridSync } from "@/hooks/useGridSync";
import { useAuth } from "@/hooks/useAuth";

const COLS = 26; // A to Z
const ROWS = 100; // 1 to 100

const getColumnName = (index: number) => String.fromCharCode(65 + index);

export default function Grid({ docId }: { docId: string }) {
  const { user } = useAuth();
  const { cells, updateCell } = useGridSync(docId, user?.uid);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

  const handleCellChange = (cellId: string, value: string) => {
    updateCell(cellId, value);
  };

  return (
    <div className="w-full h-full overflow-auto bg-white relative">
      <table className="border-collapse table-fixed">
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

                return (
                  <td 
                    key={colIndex}
                    className="border-b border-r border-gray-200 relative p-0 cursor-cell"
                    onClick={() => setSelectedCell(cellId)}
                  >
                    <input
                      type="text"
                      className={`w-full h-full min-h-[28px] px-1 outline-none text-sm ${
                        isSelected ? "ring-2 ring-blue-500 z-10 relative" : "bg-transparent"
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