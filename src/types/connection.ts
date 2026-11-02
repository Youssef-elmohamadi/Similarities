export type ConnectionType = 'Verbal' | 'Contextual' | 'Technique' | 'GeneralNote';

export interface MemorizationConnection {
  id: string;
  collectionId: string;
  title?: string;
  content: string;
  type: ConnectionType;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectionPayload {
  title?: string;
  content: string;
  type: ConnectionType;
  displayOrder?: number;
}

export interface UpdateConnectionPayload {
  title?: string;
  content: string;
  type: ConnectionType;
  displayOrder?: number;
}

