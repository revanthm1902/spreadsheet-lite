// src/types/index.ts

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  cursorColor: string;
}

// Firestore: Document Metadata
export interface SpreadsheetDoc {
  id: string;
  title: string;
  createdAt: any; 
  updatedAt: any;
  ownerId: string;
}

// RTDB: Cell Data
export interface CellData {
  id: string; 
  value: string; 
  computedValue?: string | number; 
  lastModifiedBy: string; 
  timestamp: number; 
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

// RTDB: Presence Data
export interface PresenceData {
  uid: string;
  displayName: string;
  cursorColor: string;
  activeCellId: string | null; 
  lastActive: number;
}