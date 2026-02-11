export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RequestStatus = "new" | "in_progress" | "resolved" | "closed";

export interface Database {
  public: {
    Tables: {
      requests: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          email: string;
          phone: string | null;
          language: string;
          category: string;
          message: string;
          status: RequestStatus;
          internal_notes: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          email: string;
          phone?: string | null;
          language: string;
          category: string;
          message: string;
          status?: RequestStatus;
          internal_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          language?: string;
          category?: string;
          message?: string;
          status?: RequestStatus;
          internal_notes?: string | null;
          updated_at?: string;
        };
      };
    };
  };
}

export type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
