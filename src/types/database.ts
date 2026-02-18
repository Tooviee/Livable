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
          wants_appointment: boolean;
          appointment_preference: string | null;
          appointment_date: string | null;
          appointment_time_slot: string | null;
          zoom_link: string | null;
          zoom_meeting_id: string | null;
          preferred_contact: "zoom" | "email" | "instagram";
          instagram_handle: string | null;
          reschedule_token: string | null;
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
          wants_appointment?: boolean;
          appointment_preference?: string | null;
          appointment_date?: string | null;
          appointment_time_slot?: string | null;
          zoom_link?: string | null;
          zoom_meeting_id?: string | null;
          preferred_contact?: "zoom" | "email" | "instagram";
          instagram_handle?: string | null;
          reschedule_token?: string | null;
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
          wants_appointment?: boolean;
          appointment_preference?: string | null;
          appointment_date?: string | null;
          appointment_time_slot?: string | null;
          zoom_link?: string | null;
          zoom_meeting_id?: string | null;
          preferred_contact?: "zoom" | "email" | "instagram";
          instagram_handle?: string | null;
          reschedule_token?: string | null;
        };
      };
    };
  };
}

export type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
