import { get, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";

const getColumnName = (index: number) => String.fromCharCode(65 + index);

export type ExportFormat = 'csv' | 'tsv' | 'json';

export const exportData = async (docId: string, title: string, format: ExportFormat = 'csv') => {
  try {
    const snapshot = await get(ref(rtdb, `documents/${docId}/cells`));
    const cells = snapshot.exists() ? snapshot.val() : {};

    let maxRow = 0;
    let maxCol = 0;

    Object.keys(cells).forEach(cellId => {
      if (cells[cellId]?.value) {
        const match = cellId.match(/([A-Z])([0-9]+)/);
        if (match) {
          const colIndex = match[1].charCodeAt(0) - 65;
          const rowIndex = parseInt(match[2]) - 1;
          maxCol = Math.max(maxCol, colIndex);
          maxRow = Math.max(maxRow, rowIndex);
        }
      }
    });

    maxRow = Math.max(maxRow, 4);
    maxCol = Math.max(maxCol, 4);

    let content = "";
    let mimeType = "";

    // 1. JSON Export Logic
    if (format === 'json') {
      const exportObj: Record<string, string> = {};
      for (let r = 0; r <= maxRow; r++) {
        for (let c = 0; c <= maxCol; c++) {
          const cellId = `${getColumnName(c)}${r + 1}`;
          if (cells[cellId]?.value) exportObj[cellId] = cells[cellId].value;
        }
      }
      content = JSON.stringify(exportObj, null, 2);
      mimeType = "application/json";
    } 
    // 2. CSV / TSV Export Logic
    else {
      const separator = format === 'tsv' ? '\t' : ',';
      for (let r = 0; r <= maxRow; r++) {
        const rowData = [];
        for (let c = 0; c <= maxCol; c++) {
          const cellId = `${getColumnName(c)}${r + 1}`;
          let val = cells[cellId]?.value || "";
          
          if (val.includes(separator) || val.includes('"') || val.includes("\n")) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          rowData.push(val);
        }
        content += rowData.join(separator) + "\n";
      }
      mimeType = format === 'tsv' ? "text/tab-separated-values" : "text/csv";
    }

    // 3. Trigger Download
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${title.trim() || 'spreadsheet'}.${format}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error(`Failed to export ${format}:`, error);
    alert("Failed to export document.");
  }
};