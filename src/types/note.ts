export interface PersonalNote {
  id: string;
  collectionId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonalNotePayload {
  content: string;
}

export interface UpdatePersonalNotePayload {
  content: string;
}

