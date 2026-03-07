const CURSOR_COLORS = [
  "#FF0000", "#00FF00", "#0000FF", "#FFA500", 
  "#800080", "#008080", "#FFC0CB", "#00FFFF"
];

export const getRandomColor = () => {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
};