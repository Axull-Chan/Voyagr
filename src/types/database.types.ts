export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          estimated_cost: number | null
          id: string
          lat: number | null
          lng: number | null
          location_name: string | null
          sort_order: number
          start_time: string | null
          time_slot: string | null
          title: string
          travel_time_minutes: number | null
          trip_day_id: string
          walking_distance_km: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          estimated_cost?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          sort_order?: number
          start_time?: string | null
          time_slot?: string | null
          title: string
          travel_time_minutes?: number | null
          trip_day_id: string
          walking_distance_km?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          estimated_cost?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          sort_order?: number
          start_time?: string | null
          time_slot?: string | null
          title?: string
          travel_time_minutes?: number | null
          trip_day_id?: string
          walking_distance_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_breakdown: {
        Row: {
          actual_amount: number
          category: string
          created_at: string
          id: string
          planned_amount: number
          trip_id: string
        }
        Insert: {
          actual_amount?: number
          category: string
          created_at?: string
          id?: string
          planned_amount?: number
          trip_id: string
        }
        Update: {
          actual_amount?: number
          category?: string
          created_at?: string
          id?: string
          planned_amount?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_breakdown_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          description: string | null
          expense_date: string
          id: string
          trip_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          currency: string
          description?: string | null
          expense_date?: string
          id?: string
          trip_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          metadata: Json | null
          name: string
          trip_id: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          name: string
          trip_id?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          name?: string
          trip_id?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          amenities: string[]
          booking_url: string | null
          check_in_date: string | null
          check_out_date: string | null
          created_at: string
          id: string
          image_url: string | null
          is_primary: boolean
          lat: number | null
          lng: number | null
          name: string
          nights: number | null
          price_per_night: number | null
          rating: number | null
          source: string
          total_cost: number | null
          trip_id: string
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          booking_url?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_primary?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          nights?: number | null
          price_per_night?: number | null
          rating?: number | null
          source?: string
          total_cost?: number | null
          trip_id: string
        }
        Update: {
          address?: string | null
          amenities?: string[]
          booking_url?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_primary?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          nights?: number | null
          price_per_night?: number | null
          rating?: number | null
          source?: string
          total_cost?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_lists: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_checked: boolean
          item: string
          sort_order: number
          trip_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean
          item: string
          sort_order?: number
          trip_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean
          item?: string
          sort_order?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_lists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          preferred_currency: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferred_currency?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          created_at: string
          cuisine: string | null
          distance_km: number | null
          google_maps_url: string | null
          id: string
          lat: number | null
          lng: number | null
          meal_type: string | null
          name: string
          opening_hours: string | null
          price_level: number | null
          rating: number | null
          trip_day_id: string
        }
        Insert: {
          created_at?: string
          cuisine?: string | null
          distance_km?: number | null
          google_maps_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          meal_type?: string | null
          name: string
          opening_hours?: string | null
          price_level?: number | null
          rating?: number | null
          trip_day_id: string
        }
        Update: {
          created_at?: string
          cuisine?: string | null
          distance_km?: number | null
          google_maps_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          meal_type?: string | null
          name?: string
          opening_hours?: string | null
          price_level?: number | null
          rating?: number | null
          trip_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
        ]
      }
      transportation: {
        Row: {
          arrive_at: string | null
          booking_reference: string | null
          cost: number | null
          created_at: string
          depart_at: string | null
          duration_minutes: number | null
          from_location: string
          id: string
          mode: string
          notes: string | null
          provider: string | null
          sort_order: number
          to_location: string
          trip_day_id: string | null
          trip_id: string
        }
        Insert: {
          arrive_at?: string | null
          booking_reference?: string | null
          cost?: number | null
          created_at?: string
          depart_at?: string | null
          duration_minutes?: number | null
          from_location: string
          id?: string
          mode: string
          notes?: string | null
          provider?: string | null
          sort_order?: number
          to_location: string
          trip_day_id?: string | null
          trip_id: string
        }
        Update: {
          arrive_at?: string | null
          booking_reference?: string | null
          cost?: number | null
          created_at?: string
          depart_at?: string | null
          duration_minutes?: number | null
          from_location?: string
          id?: string
          mode?: string
          notes?: string | null
          provider?: string | null
          sort_order?: number
          to_location?: string
          trip_day_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transportation_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportation_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          created_at: string
          daily_budget: number | null
          daily_cost: number | null
          date: string | null
          day_number: number
          id: string
          summary: string | null
          trip_id: string
        }
        Insert: {
          created_at?: string
          daily_budget?: number | null
          daily_cost?: number | null
          date?: string | null
          day_number: number
          id?: string
          summary?: string | null
          trip_id: string
        }
        Update: {
          created_at?: string
          daily_budget?: number | null
          daily_cost?: number | null
          date?: string | null
          day_number?: number
          id?: string
          summary?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          trip_day_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          trip_day_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          trip_day_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_notes_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          accommodation: string | null
          additional_notes: string | null
          budget: number | null
          cover_image_credit_name: string | null
          cover_image_credit_url: string | null
          cover_image_link: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          destination: string
          end_date: string | null
          id: string
          interests: string[]
          is_favorite: boolean
          start_date: string | null
          starting_city: string | null
          status: string
          title: string
          transportation: string | null
          travel_style: string | null
          travelers: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accommodation?: string | null
          additional_notes?: string | null
          budget?: number | null
          cover_image_credit_name?: string | null
          cover_image_credit_url?: string | null
          cover_image_link?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          destination: string
          end_date?: string | null
          id?: string
          interests?: string[]
          is_favorite?: boolean
          start_date?: string | null
          starting_city?: string | null
          status?: string
          title: string
          transportation?: string | null
          travel_style?: string | null
          travelers?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accommodation?: string | null
          additional_notes?: string | null
          budget?: number | null
          cover_image_credit_name?: string | null
          cover_image_credit_url?: string | null
          cover_image_link?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          destination?: string
          end_date?: string | null
          id?: string
          interests?: string[]
          is_favorite?: boolean
          start_date?: string | null
          starting_city?: string | null
          status?: string
          title?: string
          transportation?: string | null
          travel_style?: string | null
          travelers?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weather: {
        Row: {
          condition: string
          fetched_at: string
          humidity: number | null
          id: string
          precipitation_chance: number | null
          source: string
          sunrise: string | null
          sunset: string | null
          temp_high_c: number | null
          temp_low_c: number | null
          trip_day_id: string
          wind_kph: number | null
        }
        Insert: {
          condition: string
          fetched_at?: string
          humidity?: number | null
          id?: string
          precipitation_chance?: number | null
          source?: string
          sunrise?: string | null
          sunset?: string | null
          temp_high_c?: number | null
          temp_low_c?: number | null
          trip_day_id: string
          wind_kph?: number | null
        }
        Update: {
          condition?: string
          fetched_at?: string
          humidity?: number | null
          id?: string
          precipitation_chance?: number | null
          source?: string
          sunrise?: string | null
          sunset?: string | null
          temp_high_c?: number | null
          temp_low_c?: number | null
          trip_day_id?: string
          wind_kph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: true
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
