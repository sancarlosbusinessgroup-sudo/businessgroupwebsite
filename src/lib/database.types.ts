// Generated from the Supabase schema (supabase gen types), trimmed of unused helper generics.
// Regenerate after changing migrations: npx supabase gen types typescript --project-id <ref>

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type E = Database['public']['Enums'];

export type MemberPeriodStats = {
  profile_id: string;
  first_name: string;
  last_name: string;
  business_name: string;
  one_on_ones: number;
  referrals_given: number;
  referrals_received: number;
  closed_deals: number;
  closed_deals_received: number;
  visitors_brought: number;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12.2' };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: 'insert' | 'update' | 'delete';
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          id: number;
          row_id: string | null;
          subject_id: string | null;
          table_name: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'admin_audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance: {
        Row: {
          checked_in_at: string | null;
          meeting_id: string;
          method: string;
          profile_id: string;
          status: E['attendance_status'];
          zoom: boolean;
          joined_at: string | null;
          left_at: string | null;
          minutes: number | null;
          substitute: boolean;
        };
        Insert: {
          checked_in_at?: string | null;
          meeting_id: string;
          method?: string;
          profile_id: string;
          status?: E['attendance_status'];
          zoom?: boolean;
          joined_at?: string | null;
          left_at?: string | null;
          minutes?: number | null;
          substitute?: boolean;
        };
        Update: {
          checked_in_at?: string | null;
          meeting_id?: string;
          method?: string;
          profile_id?: string;
          status?: E['attendance_status'];
          zoom?: boolean;
          joined_at?: string | null;
          left_at?: string | null;
          minutes?: number | null;
          substitute?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance_imports: {
        Row: {
          meeting_id: string;
          source: 'zoom' | 'manual';
          zoom_uuid: string | null;
          participants: number;
          matched: number;
          status: 'done' | 'error';
          error: string | null;
          imported_at: string;
          imported_by: string | null;
        };
        Insert: {
          meeting_id: string;
          source: 'zoom' | 'manual';
          zoom_uuid?: string | null;
          participants?: number;
          matched?: number;
          status?: 'done' | 'error';
          error?: string | null;
          imported_at?: string;
          imported_by?: string | null;
        };
        Update: {
          source?: 'zoom' | 'manual';
          zoom_uuid?: string | null;
          participants?: number;
          matched?: number;
          status?: 'done' | 'error';
          error?: string | null;
          imported_at?: string;
          imported_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_imports_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: true;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_imports_imported_by_fkey';
            columns: ['imported_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance_corrections: {
        Row: { created_at: string; id: string; meeting_id: string | null; note: string; profile_id: string; resolved: boolean };
        Insert: { created_at?: string; id?: string; meeting_id?: string | null; note: string; profile_id: string; resolved?: boolean };
        Update: { created_at?: string; id?: string; meeting_id?: string | null; note?: string; profile_id?: string; resolved?: boolean };
        Relationships: [
          {
            foreignKeyName: 'attendance_corrections_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_corrections_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      champion_awards: {
        Row: {
          month: string;
          profile_id: string;
          auto_profile_id: string | null;
          reason: string | null;
          points: Json;
          chosen_by: string | null;
          chosen_at: string;
        };
        Insert: {
          month: string;
          profile_id: string;
          auto_profile_id?: string | null;
          reason?: string | null;
          points?: Json;
          chosen_by?: string | null;
          chosen_at?: string;
        };
        Update: {
          profile_id?: string;
          auto_profile_id?: string | null;
          reason?: string | null;
          points?: Json;
          chosen_by?: string | null;
          chosen_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'champion_awards_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'champion_awards_auto_profile_id_fkey';
            columns: ['auto_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'champion_awards_chosen_by_fkey';
            columns: ['chosen_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: { id: number; name: string; seat_limit: number };
        Insert: { id?: never; name: string; seat_limit?: number };
        Update: { id?: never; name?: string; seat_limit?: number };
        Relationships: [];
      };
      directory_downloads: {
        Row: { created_at: string; format: string; id: string; profile_id: string };
        Insert: { created_at?: string; format: string; id?: string; profile_id?: string };
        Update: { created_at?: string; format?: string; id?: string; profile_id?: string };
        Relationships: [
          {
            foreignKeyName: 'directory_downloads_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      email_log: {
        Row: {
          created_at: string;
          dedupe_key: string;
          error: string | null;
          id: number;
          kind: string;
          profile_id: string | null;
          recipient: string;
          status: 'sent' | 'skipped' | 'failed';
          subject: string | null;
        };
        Insert: {
          created_at?: string;
          dedupe_key: string;
          error?: string | null;
          id?: never;
          kind: string;
          profile_id?: string | null;
          recipient: string;
          status?: 'sent' | 'skipped' | 'failed';
          subject?: string | null;
        };
        Update: {
          error?: string | null;
          status?: 'sent' | 'skipped' | 'failed';
          subject?: string | null;
        };
        Relationships: [];
      };
      email_change_requests: {
        Row: { profile_id: string; new_email: string; code_hash: string; attempts: number; created_at: string; expires_at: string };
        Insert: { profile_id: string; new_email: string; code_hash: string; attempts?: number; created_at?: string; expires_at: string };
        Update: { new_email?: string; code_hash?: string; attempts?: number; created_at?: string; expires_at?: string };
        Relationships: [];
      };
      email_settings: {
        Row: { id: number; meeting_recaps_enabled: boolean; updated_by: string | null; updated_at: string };
        Insert: { id?: number; meeting_recaps_enabled?: boolean; updated_by?: string | null; updated_at?: string };
        Update: { meeting_recaps_enabled?: boolean; updated_by?: string | null; updated_at?: string };
        Relationships: [];
      };
      email_preferences: {
        Row: { prefs: Json; profile_id: string; updated_at: string };
        Insert: { prefs?: Json; profile_id: string; updated_at?: string };
        Update: { prefs?: Json; profile_id?: string; updated_at?: string };
        Relationships: [];
      };
      member_onboarding: {
        Row: {
          agreed_commitments: boolean;
          completed_at: string | null;
          invited_at: string;
          profile_id: string;
          reminded_at: string | null;
          share_contacts: boolean;
        };
        Insert: {
          agreed_commitments?: boolean;
          completed_at?: string | null;
          invited_at?: string;
          profile_id: string;
          reminded_at?: string | null;
          share_contacts?: boolean;
        };
        Update: {
          agreed_commitments?: boolean;
          completed_at?: string | null;
          invited_at?: string;
          profile_id?: string;
          reminded_at?: string | null;
          share_contacts?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'member_onboarding_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      gallery_photos: {
        Row: {
          album: E['gallery_album'];
          caption: string;
          created_at: string;
          id: string;
          image_path: string;
          taken_on: string | null;
          thumb_path: string;
          uploaded_by: string | null;
        };
        Insert: {
          album: E['gallery_album'];
          caption: string;
          created_at?: string;
          id?: string;
          image_path: string;
          taken_on?: string | null;
          thumb_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          album?: E['gallery_album'];
          caption?: string;
          created_at?: string;
          id?: string;
          image_path?: string;
          taken_on?: string | null;
          thumb_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'gallery_photos_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      guest_requests: {
        Row: {
          business_name: string | null;
          created_at: string;
          email: string;
          first_name: string;
          id: string;
          invited_by_text: string | null;
          ip_hash: string | null;
          last_name: string;
          meeting_id: string | null;
          one_on_ones_done_at: string | null;
          phone: string | null;
          website: string | null;
          referral_code: string | null;
          referrer_id: string | null;
          status: E['guest_status'];
        };
        Insert: {
          business_name?: string | null;
          created_at?: string;
          email: string;
          first_name: string;
          id?: string;
          invited_by_text?: string | null;
          ip_hash?: string | null;
          last_name: string;
          meeting_id?: string | null;
          one_on_ones_done_at?: string | null;
          phone?: string | null;
          website?: string | null;
          referral_code?: string | null;
          referrer_id?: string | null;
          status?: E['guest_status'];
        };
        Update: {
          business_name?: string | null;
          created_at?: string;
          email?: string;
          first_name?: string;
          id?: string;
          invited_by_text?: string | null;
          ip_hash?: string | null;
          last_name?: string;
          meeting_id?: string | null;
          one_on_ones_done_at?: string | null;
          phone?: string | null;
          website?: string | null;
          referral_code?: string | null;
          referrer_id?: string | null;
          status?: E['guest_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'guest_requests_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guest_requests_referrer_id_fkey';
            columns: ['referrer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      leadership: {
        Row: {
          bio: string | null;
          created_at: string;
          id: string;
          name: string;
          photo_path: string | null;
          profile_id: string | null;
          role: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          photo_path?: string | null;
          profile_id?: string | null;
          role: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          photo_path?: string | null;
          profile_id?: string | null;
          role?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leadership_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_links: {
        Row: { join_url: string; meeting_id: string; passcode: string | null };
        Insert: { join_url: string; meeting_id: string; passcode?: string | null };
        Update: { join_url?: string; meeting_id?: string; passcode?: string | null };
        Relationships: [
          {
            foreignKeyName: 'meeting_links_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: true;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
        ];
      };
      member_events: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          ends_at: string;
          host_id: string;
          id: string;
          image_path: string | null;
          is_online: boolean;
          location: string | null;
          online_url: string | null;
          slug: string;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          host_id?: string;
          id?: string;
          image_path?: string | null;
          is_online?: boolean;
          location?: string | null;
          online_url?: string | null;
          slug?: string;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          host_id?: string;
          id?: string;
          image_path?: string | null;
          is_online?: boolean;
          location?: string | null;
          online_url?: string | null;
          slug?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'member_events_host_id_fkey'; columns: ['host_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      meeting_slide_links: {
        Row: {
          id: string;
          meeting_id: string;
          url: string;
          title: string | null;
          after_slide: string;
          sort: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          url: string;
          title?: string | null;
          after_slide: string;
          sort?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: { title?: string | null; after_slide?: string; sort?: number };
        Relationships: [
          {
            foreignKeyName: 'meeting_slide_links_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_slide_media: {
        Row: {
          id: string;
          meeting_id: string;
          kind: 'image' | 'pdf' | 'youtube' | 'powerpoint';
          title: string | null;
          storage_path: string | null;
          youtube_id: string | null;
          start_seconds: number;
          page_count: number | null;
          after_slide: string;
          sort: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          kind: 'image' | 'pdf' | 'youtube' | 'powerpoint';
          title?: string | null;
          storage_path?: string | null;
          youtube_id?: string | null;
          start_seconds?: number;
          page_count?: number | null;
          after_slide: string;
          sort?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string | null;
          after_slide?: string;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_slide_media_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_slide_settings: {
        Row: { meeting_id: string; slides: string[]; notes: Json; timers: Json; updated_at: string };
        Insert: { meeting_id: string; slides: string[]; notes?: Json; timers?: Json; updated_at?: string };
        Update: { meeting_id?: string; slides?: string[]; notes?: Json; timers?: Json; updated_at?: string };
        Relationships: [
          {
            foreignKeyName: 'meeting_slide_settings_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: true;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_speakers: {
        Row: {
          business: string | null;
          created_at: string;
          display_name: string;
          meeting_id: string;
          profile_id: string | null;
          slot: E['speaker_slot'];
          topic: string | null;
          topic_description: string | null;
        };
        Insert: {
          business?: string | null;
          created_at?: string;
          display_name: string;
          meeting_id: string;
          profile_id?: string | null;
          slot: E['speaker_slot'];
          topic?: string | null;
          topic_description?: string | null;
        };
        Update: {
          business?: string | null;
          created_at?: string;
          display_name?: string;
          meeting_id?: string;
          profile_id?: string | null;
          slot?: E['speaker_slot'];
          topic?: string | null;
          topic_description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_speakers_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_speakers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meetings: {
        Row: {
          cancelled_reason: string | null;
          category: string;
          created_at: string;
          description: string | null;
          ends_at: string;
          id: string;
          is_online: boolean;
          location: string | null;
          organizer_id: string | null;
          slug: string;
          starts_at: string;
          tags: string[];
          title: string;
        };
        Insert: {
          cancelled_reason?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          is_online?: boolean;
          location?: string | null;
          organizer_id?: string | null;
          slug: string;
          starts_at: string;
          tags?: string[];
          title: string;
        };
        Update: {
          cancelled_reason?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          id?: string;
          is_online?: boolean;
          location?: string | null;
          organizer_id?: string | null;
          slug?: string;
          starts_at?: string;
          tags?: string[];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meetings_organizer_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      member_applications: {
        Row: {
          agreed_at: string;
          applied_on: string;
          business_address: string | null;
          business_phone: string | null;
          created_at: string;
          credentials: string | null;
          networking_groups: string | null;
          product_service: string;
          profile_id: string;
          references: Json;
          signature_name: string;
          years_in_business: string;
        };
        Insert: {
          agreed_at?: string;
          applied_on?: string;
          business_address?: string | null;
          business_phone?: string | null;
          created_at?: string;
          credentials?: string | null;
          networking_groups?: string | null;
          product_service: string;
          profile_id: string;
          references?: Json;
          signature_name: string;
          years_in_business: string;
        };
        Update: {
          agreed_at?: string;
          applied_on?: string;
          business_address?: string | null;
          business_phone?: string | null;
          created_at?: string;
          credentials?: string | null;
          networking_groups?: string | null;
          product_service?: string;
          profile_id?: string;
          references?: Json;
          signature_name?: string;
          years_in_business?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_applications_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      member_contacts: {
        Row: { email: string; phone: string | null; profile_id: string };
        Insert: { email: string; phone?: string | null; profile_id: string };
        Update: { email?: string; phone?: string | null; profile_id?: string };
        Relationships: [
          {
            foreignKeyName: 'member_contacts_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      one_on_one_feedback: {
        Row: { author_id: string; created_at: string; note: string | null; one_on_one_id: string };
        Insert: { author_id: string; created_at?: string; note?: string | null; one_on_one_id: string };
        Update: { author_id?: string; created_at?: string; note?: string | null; one_on_one_id?: string };
        Relationships: [
          {
            foreignKeyName: 'one_on_one_feedback_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'one_on_one_feedback_one_on_one_id_fkey';
            columns: ['one_on_one_id'];
            isOneToOne: false;
            referencedRelation: 'one_on_ones';
            referencedColumns: ['id'];
          },
        ];
      };
      one_on_one_requests: {
        Row: {
          created_at: string;
          id: string;
          invitee_id: string;
          message: string | null;
          proposed_on: string | null;
          replied_at: string | null;
          reply: string | null;
          requester_id: string;
          responded_at: string | null;
          status: 'pending' | 'accepted' | 'declined' | 'cancelled';
        };
        Insert: {
          created_at?: string;
          id?: string;
          invitee_id: string;
          message?: string | null;
          proposed_on?: string | null;
          replied_at?: string | null;
          reply?: string | null;
          requester_id?: string;
          responded_at?: string | null;
          status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
        };
        Update: {
          created_at?: string;
          id?: string;
          invitee_id?: string;
          message?: string | null;
          proposed_on?: string | null;
          replied_at?: string | null;
          reply?: string | null;
          requester_id?: string;
          responded_at?: string | null;
          status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
        };
        Relationships: [
          {
            foreignKeyName: 'one_on_one_requests_invitee_id_fkey';
            columns: ['invitee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'one_on_one_requests_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      one_on_ones: {
        Row: { confirmed_at: string | null; created_at: string; id: string; met_on: string; partner_id: string | null; reporter_id: string | null };
        Insert: { confirmed_at?: string | null; created_at?: string; id?: string; met_on: string; partner_id: string; reporter_id: string };
        Update: { confirmed_at?: string | null; created_at?: string; id?: string; met_on?: string; partner_id?: string; reporter_id?: string };
        Relationships: [
          {
            foreignKeyName: 'one_on_ones_partner_id_fkey';
            columns: ['partner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'one_on_ones_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          about: string | null;
          agreed_commitments: boolean;
          approved_at: string | null;
          avatar_path: string | null;
          business_name: string;
          category_id: number | null;
          city: string | null;
          created_at: string;
          first_name: string;
          guest_meetings_attended: number;
          id: string;
          is_owner: boolean;
          ideal_client: string | null;
          last_name: string;
          listen_for: string | null;
          logo_path: string | null;
          member_since: string | null;
          referral_code: string;
          referred_by: string | null;
          role: E['member_role'];
          service_area: string | null;
          services: string[];
          show_in_directory: boolean;
          show_phone_public: boolean;
          slug: string;
          status: E['member_status'];
          updated_at: string;
          weekly_ask: string | null;
          weekly_ask_updated_at: string | null;
          website: string | null;
        };
        Insert: {
          about?: string | null;
          agreed_commitments?: boolean;
          approved_at?: string | null;
          avatar_path?: string | null;
          business_name: string;
          category_id?: number | null;
          city?: string | null;
          created_at?: string;
          first_name: string;
          guest_meetings_attended?: number;
          id: string;
          is_owner?: boolean;
          ideal_client?: string | null;
          last_name: string;
          listen_for?: string | null;
          logo_path?: string | null;
          member_since?: string | null;
          referral_code: string;
          referred_by?: string | null;
          role?: E['member_role'];
          service_area?: string | null;
          services?: string[];
          show_in_directory?: boolean;
          show_phone_public?: boolean;
          slug: string;
          status?: E['member_status'];
          updated_at?: string;
          weekly_ask?: string | null;
          weekly_ask_updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          about?: string | null;
          agreed_commitments?: boolean;
          approved_at?: string | null;
          avatar_path?: string | null;
          business_name?: string;
          category_id?: number | null;
          city?: string | null;
          created_at?: string;
          first_name?: string;
          guest_meetings_attended?: number;
          id?: string;
          is_owner?: boolean;
          ideal_client?: string | null;
          last_name?: string;
          listen_for?: string | null;
          logo_path?: string | null;
          member_since?: string | null;
          referral_code?: string;
          referred_by?: string | null;
          role?: E['member_role'];
          service_area?: string | null;
          services?: string[];
          show_in_directory?: boolean;
          show_phone_public?: boolean;
          slug?: string;
          status?: E['member_status'];
          updated_at?: string;
          weekly_ask?: string | null;
          weekly_ask_updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_referred_by_fkey';
            columns: ['referred_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      referrals: {
        Row: {
          amount: number | null;
          closed_at: string | null;
          contact_name: string;
          created_at: string;
          from_id: string | null;
          id: string;
          notes: string | null;
          prospect_consent: boolean;
          prospect_email: string | null;
          prospect_phone: string | null;
          status: E['referral_status'];
          to_id: string | null;
          updated_at: string;
          warmth: E['referral_warmth'];
        };
        Insert: {
          amount?: number | null;
          closed_at?: string | null;
          contact_name: string;
          created_at?: string;
          from_id: string;
          id?: string;
          notes?: string | null;
          prospect_consent?: boolean;
          prospect_email?: string | null;
          prospect_phone?: string | null;
          status?: E['referral_status'];
          to_id: string;
          updated_at?: string;
          warmth?: E['referral_warmth'];
        };
        Update: {
          amount?: number | null;
          closed_at?: string | null;
          contact_name?: string;
          created_at?: string;
          from_id?: string;
          id?: string;
          notes?: string | null;
          prospect_consent?: boolean;
          prospect_email?: string | null;
          prospect_phone?: string | null;
          status?: E['referral_status'];
          to_id?: string;
          updated_at?: string;
          warmth?: E['referral_warmth'];
        };
        Relationships: [
          { foreignKeyName: 'referrals_from_id_fkey'; columns: ['from_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'referrals_to_id_fkey'; columns: ['to_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      rsvps: {
        Row: { attending: boolean; created_at: string; meeting_id: string; profile_id: string };
        Insert: { attending?: boolean; created_at?: string; meeting_id: string; profile_id: string };
        Update: { attending?: boolean; created_at?: string; meeting_id?: string; profile_id?: string };
        Relationships: [
          { foreignKeyName: 'rsvps_meeting_id_fkey'; columns: ['meeting_id']; isOneToOne: false; referencedRelation: 'meetings'; referencedColumns: ['id'] },
          { foreignKeyName: 'rsvps_profile_id_fkey'; columns: ['profile_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      zoom_participants: {
        Row: {
          id: string;
          meeting_id: string;
          key: string;
          name: string;
          email: string | null;
          joined_at: string | null;
          left_at: string | null;
          minutes: number;
          resolution: 'member' | 'guest' | 'visitor' | 'ignored' | 'pending';
          matched_by: 'email' | 'name' | 'alias' | 'admin' | null;
          profile_id: string | null;
          guest_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          key: string;
          name: string;
          email?: string | null;
          joined_at?: string | null;
          left_at?: string | null;
          minutes?: number;
          resolution?: 'member' | 'guest' | 'visitor' | 'ignored' | 'pending';
          matched_by?: 'email' | 'name' | 'alias' | 'admin' | null;
          profile_id?: string | null;
          guest_id?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          email?: string | null;
          joined_at?: string | null;
          left_at?: string | null;
          minutes?: number;
          resolution?: 'member' | 'guest' | 'visitor' | 'ignored' | 'pending';
          matched_by?: 'email' | 'name' | 'alias' | 'admin' | null;
          profile_id?: string | null;
          guest_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'zoom_participants_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'zoom_participants_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'zoom_participants_guest_id_fkey';
            columns: ['guest_id'];
            isOneToOne: false;
            referencedRelation: 'guest_requests';
            referencedColumns: ['id'];
          },
        ];
      };
      zoom_aliases: {
        Row: { key: string; profile_id: string; created_at: string };
        Insert: { key: string; profile_id: string; created_at?: string };
        Update: { profile_id?: string };
        Relationships: [
          {
            foreignKeyName: 'zoom_aliases_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_member_amounts: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: { profile_id: string; closed_amount_given: number; closed_amount_received: number }[];
      };
      respond_one_on_one_request: { Args: { p_id: string; p_status: string }; Returns: undefined };
      reply_one_on_one_request: { Args: { p_id: string; p_message: string }; Returns: string };
      file_closed_business: {
        Args: { p_to: string; p_contact_name: string; p_phone: string | null; p_email: string | null; p_amount: number | null; p_notes: string | null };
        Returns: string;
      };
      file_closed_business_on: {
        Args: {
          p_to: string;
          p_contact_name: string;
          p_phone: string | null;
          p_email: string | null;
          p_amount: number | null;
          p_notes: string | null;
          p_closed_on?: string | null;
        };
        Returns: string;
      };
      set_speaker_topic: { Args: { p_meeting: string; p_slot: string; p_topic: string; p_description: string }; Returns: undefined };
      admin_member_stats: { Args: { p_from?: string | null; p_to?: string | null }; Returns: MemberPeriodStats[] };
      confirm_one_on_one: { Args: { p_id: string }; Returns: undefined };
      complete_onboarding: { Args: { p_share_contacts: boolean; p_agreed: boolean }; Returns: undefined };
      group_totals: { Args: { p_from?: string | null; p_to?: string | null }; Returns: Json };
      is_admin: { Args: never; Returns: boolean };
      is_owner: { Args: never; Returns: boolean };
      is_approved_member: { Args: never; Returns: boolean };
      join_meeting: { Args: { p_meeting: string }; Returns: string };
      leaderboard: {
        Args: { p_from?: string | null; p_to?: string | null; p_limit?: number };
        Returns: { first_name: string; last_name: string; metric: string; profile_id: string; rank: number; value: number }[];
      };
      meeting_visitors: { Args: { p_meeting: string }; Returns: { business_name: string | null; display_name: string; invited_by: string | null }[] };
      member_count: { Args: never; Returns: number };
      open_categories: { Args: never; Returns: { id: number; name: string; seat_limit: number; taken: number }[] };
      public_phone: { Args: { p_slug: string }; Returns: string };
    };
    Enums: {
      attendance_status: 'present' | 'excused' | 'absent';
      gallery_album: 'meetings' | 'mixers' | 'spotlights' | 'community';
      guest_status: 'requested' | 'visited' | 'applied' | 'joined';
      member_role: 'member' | 'admin';
      member_status: 'pending' | 'approved' | 'declined' | 'inactive';
      referral_status: 'new' | 'contacted' | 'meeting_set' | 'closed_deal' | 'not_a_fit';
      referral_warmth: 'hot' | 'warm' | 'cold';
      speaker_slot: 'education' | 'presentation';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
export type { Rel };
