import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGridSync, SyncState } from "@/hooks/useGridSync";
import { usePresence } from "@/hooks/usePresence";
import { evaluateFormula } from "@/lib/formula";
import { Bold, Italic, Type, PaintBucket } from "lucide-react";

const COLS = 26;
const ROWS = 100;
const getColumnName = (index: number) => String.fromCharCode(65 + index);

interface GridProps {
  docId: string;
  setSyncState: (state: SyncState) => void;
}

export default function Grid({ docId, setSyncState }: GridProps) {
  const { user } = useAuth();
  
  const { cells, updateCell, updateFormat } = useGridSync(docId, user?.uid, setSyncState);
  const { activeUsers, updateCursor } = usePresence(docId, user);
  
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const [selectionStart, setSelectionStart] = useState<{col: number, row: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{col: number, row: number} | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [colOrder, setColOrder] = useState<number[]>(Array.from({ length: COLS }, (_, i) => i));
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
  const [resizing, setResizing] = useState<{ type: 'col' | 'row', index: number, startPos: number, startSize: number } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsSelecting(false);
      setResizing(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // --- SELECTION LOGIC ---
  const handleCellMouseDown = (colIdx: number, rowIdx: number) => {
    if (editingCell) return;
    setSelectionStart({ col: colIdx, row: rowIdx });
    setSelectionEnd({ col: colIdx, row: rowIdx });
    setIsSelecting(true);
    
    // Update cursor and selection directly on click
    const cellId = `${getColumnName(colOrder[colIdx])}${rowIdx + 1}`;
    setSelectedCell(cellId);
    updateCursor(cellId);
  };

  const handleCellMouseEnter = (colIdx: number, rowIdx: number) => {
    if (isSelecting) setSelectionEnd({ col: colIdx, row: rowIdx });
  };

  const selectFullColumn = (colIdx: number) => {
    setSelectionStart({ col: colIdx, row: 0 });
    setSelectionEnd({ col: colIdx, row: ROWS - 1 });
    
    const cellId = `${getColumnName(colOrder[colIdx])}1`;
    setSelectedCell(cellId);
    updateCursor(cellId);
  };

  const selectFullRow = (rowIdx: number) => {
    setSelectionStart({ col: 0, row: rowIdx });
    setSelectionEnd({ col: COLS - 1, row: rowIdx });
    
    const cellId = `${getColumnName(colOrder[0])}${rowIdx + 1}`;
    setSelectedCell(cellId);
    updateCursor(cellId);
  };

  const isCellSelected = (c: number, r: number) => {
    if (!selectionStart || !selectionEnd) return false;
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);
    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
    return c >= minCol && c <= maxCol && r >= minRow && r <= maxRow;
  };

  const getSelectedCellIds = () => {
    if (!selectionStart || !selectionEnd) {
      return selectedCell ? [selectedCell] : [];
    }
    const ids: string[] = [];
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);
    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        ids.push(`${getColumnName(colOrder[c])}${r + 1}`);
      }
    }
    return ids;
  };

  // --- RESIZE LOGIC ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      if (resizing.type === 'col') {
        setColWidths(prev => ({ ...prev, [resizing.index]: Math.max(50, resizing.startSize + (e.clientX - resizing.startPos)) }));
      } else {
        setRowHeights(prev => ({ ...prev, [resizing.index]: Math.max(32, resizing.startSize + (e.clientY - resizing.startPos)) }));
      }
    };
    if (resizing) window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [resizing]);

  // --- REORDER LOGIC ---
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

  return (
    <div className="flex flex-col w-full h-full relative">
      
      {/* FORMATTING TOOLBAR */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-slate-200 bg-white text-gray-700 z-50">
        <button onClick={() => updateFormat(getSelectedCellIds(), { bold: cells[selectedCell || ""]?.bold ? false : true })} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 font-bold transition-colors"><Bold size={15} /></button>
        <button onClick={() => updateFormat(getSelectedCellIds(), { italic: cells[selectedCell || ""]?.italic ? false : true })} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 italic transition-colors"><Italic size={15} /></button>
        <div className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0" />
        <select 
          onChange={(e) => updateFormat(getSelectedCellIds(), { fontFamily: e.target.value })}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 h-7 outline-none bg-white cursor-pointer text-slate-600 hover:border-slate-300 transition-colors"
          value={cells[selectedCell || ""]?.fontFamily || "sans-serif"}
        >
          <option value="sans-serif">Sans Serif</option>
          <option value="serif">Serif</option>
          <option value="monospace">Monospace</option>
        </select>
        <div className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0" />
        <div className="flex items-center gap-1 border border-slate-200 rounded-md p-1 bg-white relative cursor-pointer hover:bg-slate-100 transition-colors h-7">
          <Type size={14} />
          <input type="color" className="w-5 h-5 cursor-pointer border-none p-0 bg-transparent" value={cells[selectedCell || ""]?.textColor || "#000000"} onChange={(e) => updateFormat(getSelectedCellIds(), { textColor: e.target.value })} title="Text Color"/>
        </div>
        <div className="flex items-center gap-1 border border-slate-200 rounded-md p-1 bg-white relative cursor-pointer hover:bg-slate-100 transition-colors h-7">
          <PaintBucket size={14} />
          <input type="color" className="w-5 h-5 cursor-pointer border-none p-0 bg-transparent" value={cells[selectedCell || ""]?.backgroundColor || "#ffffff"} onChange={(e) => updateFormat(getSelectedCellIds(), { backgroundColor: e.target.value })} title="Fill Color"/>
        </div>
      </div>

      {/* SPREADSHEET GRID */}
      <div className={`w-full h-full overflow-auto bg-white relative sheet-scroll ${resizing ? (resizing.type === 'col' ? 'cursor-col-resize' : 'cursor-row-resize') : ''}`}>
        <table className="border-collapse table-fixed select-none min-w-max bg-white">
          <thead>
            <tr>
              {/* Top Left Corner */}
              <th className="sticky top-0 left-0 z-40 w-12 h-8 bg-slate-50 border-b border-r border-slate-200"></th>
              
              {colOrder.map((originalColIndex, visualIndex) => (
                <th 
                  key={originalColIndex} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, visualIndex)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, visualIndex)}
                  onClick={() => selectFullColumn(visualIndex)} 
                  style={{ 
                    width: colWidths[originalColIndex] || 150, 
                    minWidth: colWidths[originalColIndex] || 150 
                  }}
                  className={`sticky top-0 z-30 h-8 bg-slate-50 border-b border-r border-slate-200 font-medium text-xs text-slate-500 text-center hover:bg-slate-100 transition-colors cursor-grab active:cursor-grabbing select-none ${draggedColIndex === visualIndex ? 'opacity-40' : ''}`}
                >
                  {getColumnName(originalColIndex)}
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50 transition-colors"
                    onMouseDown={(e) => {
                      e.stopPropagation(); 
                      e.preventDefault(); 
                      setResizing({ type: 'col', index: originalColIndex, startPos: e.clientX, startSize: colWidths[originalColIndex] || 150 });
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                <td 
                  className="sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200 text-center text-xs text-slate-500 font-medium cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  style={{ height: rowHeights[rowIndex] || 32 }}
                  onClick={() => selectFullRow(rowIndex)} 
                >
                  {rowIndex + 1}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-400 z-50 transition-colors"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault(); 
                      setResizing({ type: 'row', index: rowIndex, startPos: e.clientY, startSize: rowHeights[rowIndex] || 32 });
                    }}
                  />
                </td>
                
                {colOrder.map((originalColIndex, visualIndex) => {
                  const cellId = `${getColumnName(originalColIndex)}${rowIndex + 1}`;
                  const inSelection = isCellSelected(visualIndex, rowIndex);
                  const isPrimarySelect = selectionStart?.col === visualIndex && selectionStart?.row === rowIndex;
                  const isEditing = editingCell === cellId;
                  
                  const rawValue = cells[cellId]?.value || "";
                  const displayValue = isEditing ? rawValue : evaluateFormula(rawValue, cells);
                  const occupyingUser = Object.values(activeUsers).find(u => u.uid !== user?.uid && u.activeCellId === cellId);

                  return (
                    <td 
                      key={originalColIndex}
                      style={{ backgroundColor: cells[cellId]?.backgroundColor || '#ffffff' }}
                      className="border-b border-r border-slate-100 relative p-0 cursor-cell"
                      onMouseDown={() => handleCellMouseDown(visualIndex, rowIndex)}
                      onMouseEnter={() => handleCellMouseEnter(visualIndex, rowIndex)}
                    >
                      {occupyingUser && (
                        <div className="absolute inset-0 z-30 pointer-events-none border-2" style={{ borderColor: occupyingUser.cursorColor }} />
                      )}
                      
                      {inSelection && (
                        <div className={`absolute inset-0 pointer-events-none border-blue-500 z-20 ${
                          isPrimarySelect ? 'border-2' : 'border bg-blue-500/10' 
                        }`} />
                      )}
                      
                      <input
                        id={`cell-input-${cellId}`}
                        type="text"
                        style={{
                          fontWeight: cells[cellId]?.bold ? 'bold' : 'normal',
                          fontStyle: cells[cellId]?.italic ? 'italic' : 'normal',
                          color: cells[cellId]?.textColor || 'inherit',
                          fontFamily: cells[cellId]?.fontFamily || 'inherit',
                        }}
                        className={`absolute inset-0 w-full h-full px-1.5 outline-none text-sm bg-transparent z-10 ${
                          inSelection && !isEditing ? "caret-transparent cursor-cell" : ""
                        }`}
                        value={displayValue}
                        onChange={(e) => updateCell(cellId, e.target.value)}
                        onDoubleClick={() => setEditingCell(cellId)}
                        onBlur={() => setEditingCell(null)}
                        readOnly={!isEditing}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}