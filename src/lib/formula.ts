// Helper to get column letter to number (A->0, B->1)
const colToInt = (col: string) => col.charCodeAt(0) - 65;
const intToCol = (int: number) => String.fromCharCode(65 + int);

// Helper to expand ranges like "A1:A3" into ["A1", "A2", "A3"]
const expandRange = (start: string, end: string): string[] => {
  const matchStart = start.match(/([A-Z]+)([0-9]+)/);
  const matchEnd = end.match(/([A-Z]+)([0-9]+)/);
  if (!matchStart || !matchEnd) return [start];

  const startCol = colToInt(matchStart[1]);
  const startRow = parseInt(matchStart[2]);
  const endCol = colToInt(matchEnd[1]);
  const endRow = parseInt(matchEnd[2]);

  const cells: string[] = [];
  for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      cells.push(`${intToCol(c)}${r}`);
    }
  }
  return cells;
};

// Recursive function to get a cell's numeric value
const getCellValue = (
  cellId: string, 
  cells: Record<string, { value: string }>, 
  visited: Set<string>
): number => {
  if (visited.has(cellId)) throw new Error("#CYCLE!"); // Prevent infinite loops
  if (!cells[cellId]?.value) return 0;

  visited.add(cellId);
  const val = evaluateFormula(cells[cellId].value, cells, visited);
  visited.delete(cellId);

  return Number(val) || 0;
};

// Main Evaluation Engine
export const evaluateFormula = (
  formula: string, 
  cells: Record<string, { value: string }>, 
  visited = new Set<string>()
): string | number => {
  if (!formula.startsWith('=')) {
    return isNaN(Number(formula)) || formula === "" ? formula : Number(formula);
  }

  try {
    const expression = formula.substring(1).toUpperCase().replace(/\s+/g, '');

    // Handle =SUM(...)
    if (expression.startsWith('SUM(') && expression.endsWith(')')) {
      const inside = expression.slice(4, -1);
      const args = inside.split(',');
      let total = 0;

      for (const arg of args) {
        if (arg.includes(':')) {
          const [start, end] = arg.split(':');
          const rangeCells = expandRange(start, end);
          for (const cellId of rangeCells) total += getCellValue(cellId, cells, visited);
        } else {
          total += isNaN(Number(arg)) ? getCellValue(arg, cells, visited) : Number(arg);
        }
      }
      return total;
    }

    // Handle basic arithmetic (=A1+B2*3)
    // Replace cell references (like A1) with their computed numeric values
    const resolvedExpression = expression.replace(/[A-Z]+[0-9]+/g, (match) => {
      return getCellValue(match, cells, visited).toString();
    });

    // Safely evaluate the math string
    // eslint-disable-next-line no-new-func
    return new Function(`return ${resolvedExpression}`)();
  } catch (e) {
    return (e as Error).message === "#CYCLE!" ? "#CYCLE!" : "#ERROR!";
  }
};