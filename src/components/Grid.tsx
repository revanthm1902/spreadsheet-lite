import { useState } from "react";

const COLS = 26; // A to Z
const ROWS = 100; // 1 to 100

// Helper to convert index 0-25 to A-Z
const getColumnName = (index: number) => String.fromCharCode(65 + index);

export default function Grid() {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

  return (
    <div className="w-full h-full overflow-auto bg-white relative">
      <table className="border-collapse table-fixed">
        <thead>
          <tr>
            {/* Top-Left Corner (Sticks to top and left) */}
            <th className="sticky top-0 left-0 z-30 w-12 h-8 bg-gray-100 border-b border-r border-gray-300"></th>
            
            {/* Column Headers (A, B, C...) (Sticks to top) */}
            {Array.from({ length: COLS }).map((_, colIndex) => (
              <th 
                key={colIndex}
                className="sticky top-0 z-20 w-28 h-8 bg-gray-100 border-b border-r border-gray-300 font-normal text-sm text-gray-600 text-center select-none"
              >
                {getColumnName(colIndex)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {/* Row Headers (1, 2, 3...) (Sticks to left) */}
              <td className="sticky left-0 z-20 bg-gray-100 border-b border-r border-gray-300 text-center text-sm text-gray-600 select-none w-12">
                {rowIndex + 1}
              </td>
              
              {/* The Editable Cells */}
              {Array.from({ length: COLS }).map((_, colIndex) => {
                const cellId = `${getColumnName(colIndex)}${rowIndex + 1}`;
                const isSelected = selectedCell === cellId;

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
                      readOnly // We'll remove this when we add the RTDB logic
                      placeholder="" // Empty for now, will hold cell data later
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