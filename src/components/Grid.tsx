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

export default function Grid({ docId, setSyncState }: GridProps) {
  const { user } = useAuth();
  const { cells, updateCell } = useGridSync(docId, user?.uid, setSyncState);
  const { activeUsers, updateCursor } = usePresence(docId, user);
  
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  // --- NEW: VISUAL STATE (Widths, Heights, and Ordering) ---
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  
  // Track the visual order of columns [0, 1, 2...] -> [A, B, C...]
  const [colOrder, setColOrder] = useState<number[]>(Array.from({ length: COLS }, (_, i) => i));
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);

  const [resizing, setResizing] = useState<{ type: 'col' | 'row', index: number, startPos: number, startSize: number } | null>(null);

  // Broadcast cursor
  useEffect(() => {
    updateCursor(selectedCell);
  }, [selectedCell, updateCursor]);

  // Focus input on selection
  useEffect(() => {
    if (selectedCell) {
      const input = document.getElementById(`cell-input-${selectedCell}`);
      if (input) input.focus();
    }
  }, [selectedCell]);

  // --- NEW: RESIZE LOGIC ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      if (resizing.type === 'col') {
        const delta = e.clientX - resizing.startPos;
        // Minimum column width is 50px
        setColWidths(prev => ({ ...prev, [resizing.index]: Math.max(50, resizing.startSize + delta) }));
      } else {
        const delta = e.clientY - resizing.startPos;
        // Minimum row height is 28px
        setRowHeights(prev => ({ ...prev, [resizing.index]: Math.max(28, resizing.startSize + delta) }));
      }
    };
    const handleMouseUp = () => setResizing(null);

    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  // REORDER LOGIC (Drag & Drop) ---
  const handleDragStart = (e: React.DragEvent, visualIndex: number) => {
    setDraggedColIndex(visualIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetVisualIndex: number) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === targetVisualIndex) return;

    setColOrder(prev => {
      const newOrder = [...prev];
      const draggedItem = newOrder.splice(draggedColIndex, 1)[0];
      newOrder.splice(targetVisualIndex, 0, draggedItem);
      return newOrder;
    });
    setDraggedColIndex(null);
  };

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, colVisualIndex: number, rowIndex: number) => {
    let nextColVisual = colVisualIndex;
    let nextRow = rowIndex;

    switch (e.key) {
      case "ArrowUp": nextRow = Math.max(0, rowIndex - 1); break;
      case "ArrowDown":
      case "Enter": e.preventDefault(); nextRow = Math.min(ROWS - 1, rowIndex + 1); break;
      case "ArrowLeft":
        if ((e.target as HTMLInputElement).selectionStart === 0) nextColVisual = Math.max(0, colVisualIndex - 1);
        else return;
        break;
      case "ArrowRight":
        if ((e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) nextColVisual = Math.min(COLS - 1, colVisualIndex + 1);
        else return;
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) nextColVisual = Math.max(0, colVisualIndex - 1);
        else nextColVisual = Math.min(COLS - 1, colVisualIndex + 1);
        break;
      default: return;
    }

    // Map visual index back to the actual data column letter!
    const actualColIndex = colOrder[nextColVisual];
    const nextCellId = `${getColumnName(actualColIndex)}${nextRow + 1}`;
    setSelectedCell(nextCellId);
    setEditingCell(null);
  };

  return (
    <div className={`w-full h-full overflow-auto bg-white relative ${resizing ? (resizing.type === 'col' ? 'cursor-col-resize' : 'cursor-row-resize') : ''}`}>
      <table className="border-collapse table-fixed select-none">
        <thead>
          <tr>
            {/* Top-Left Corner */}
            <th className="sticky top-0 left-0 z-40 w-12 h-8 bg-gray-100 border-b border-r border-gray-300"></th>
            
            {/* Dynamic Columns */}
            {colOrder.map((originalColIndex, visualIndex) => (
              <th 
                key={originalColIndex} 
                draggable // Enables HTML5 Drag & Drop
                onDragStart={(e) => handleDragStart(e, visualIndex)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, visualIndex)}
                style={{ width: colWidths[originalColIndex] || 112 }} // 112px is default (w-28)
                className={`sticky top-0 z-30 h-8 bg-gray-100 border-b border-r border-gray-300 font-normal text-sm text-gray-600 text-center relative hover:bg-gray-200 transition-colors cursor-grab active:cursor-grabbing ${draggedColIndex === visualIndex ? 'opacity-50' : ''}`}
              >
                {getColumnName(originalColIndex)}
                
                {/* Column Resize Handle */}
                <div 
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 z-50 transition-colors"
                  onMouseDown={(e) => {
                    e.stopPropagation(); // Don't trigger drag-and-drop
                    setResizing({ type: 'col', index: originalColIndex, startPos: e.clientX, startSize: colWidths[originalColIndex] || 112 });
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {/* Dynamic Rows */}
              <td 
                className="sticky left-0 z-30 bg-gray-100 border-b border-r border-gray-300 text-center text-sm text-gray-600 relative"
                style={{ height: rowHeights[rowIndex] || 28 }}
              >
                {rowIndex + 1}
                {/* Row Resize Handle */}
                <div 
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize hover:bg-blue-500 z-50 transition-colors"
                  onMouseDown={(e) => setResizing({ type: 'row', index: rowIndex, startPos: e.clientY, startSize: rowHeights[rowIndex] || 28 })}
                />
              </td>
              
              {/* Cells mapped by the new visual order */}
              {colOrder.map((originalColIndex, visualIndex) => {
                const cellId = `${getColumnName(originalColIndex)}${rowIndex + 1}`;
                const isSelected = selectedCell === cellId;
                const isEditing = editingCell === cellId;
                
                const rawValue = cells[cellId]?.value || "";
                const displayValue = isEditing ? rawValue : evaluateFormula(rawValue, cells);

                const occupyingUser = Object.values(activeUsers).find(u => u.uid !== user?.uid && u.activeCellId === cellId);

                return (
                  <td 
                    key={originalColIndex}
                    className="border-b border-r border-gray-200 relative p-0 cursor-cell"
                    onClick={() => { setSelectedCell(cellId); if (!isEditing) setEditingCell(cellId); }}
                  >
                    {occupyingUser && (
                      <div className="absolute inset-0 z-10 pointer-events-none border-2" style={{ borderColor: occupyingUser.cursorColor }} />
                    )}
                    
                    <input
                      id={`cell-input-${cellId}`}
                      type="text"
                      className={`w-full h-full min-h-full px-1 outline-none text-sm ${
                        isSelected ? "ring-2 ring-blue-500 z-20 relative bg-white" : "bg-transparent relative z-0"
                      }`}
                      value={displayValue}
                      onChange={(e) => updateCell(cellId, e.target.value)}
                      onFocus={() => setEditingCell(cellId)}
                      onBlur={() => setEditingCell(null)}
                      onKeyDown={(e) => handleKeyDown(e, visualIndex, rowIndex)}
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