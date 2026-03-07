export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  cursorColor: string;
}

// RTDB: Cell Data
export interface CellData {
  id: string; // e.g., "A1", "B2"
  value: string; // The raw input (e.g., "=SUM(A1, A2)" or "Hello")
  computedValue?: string | number; // The evaluated result
  lastModifiedBy: string; // uid of the user
  timestamp: number; // Used for contention resolution
}

// RTDB: Presence Data
export interface PresenceData {
  uid: string;
  displayName: string;
  cursorColor: string;
  activeCellId: string | null; // Where their cursor is currently located
  lastActive: number;
}