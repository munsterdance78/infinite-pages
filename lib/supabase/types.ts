export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          subscription_tier: 'free' | 'pro';
          subscription_status: string;
          stripe_customer_id: string | null;
          current_period_end: string | null;
          tokens_remaining: number;
          tokens_used_total: number;
          last_token_grant: string | null;
          stories_created: number;
          words_generated: number;
          onboarding_complete: boolean | null;
          writing_goals: string[] | null;
          preferred_genres: string[] | null;
          experience_level: string | null;
          writing_frequency: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          subscription_tier?: 'free' | 'pro';
          subscription_status?: string;
          stripe_customer_id?: string | null;
          current_period_end?: string | null;
          tokens_remaining?: number;
          tokens_used_total?: number;
          last_token_grant?: string | null;
          stories_created?: number;
          words_generated?: number;
          onboarding_complete?: boolean | null;
          writing_goals?: string[] | null;
          preferred_genres?: string[] | null;
          experience_level?: string | null;
          writing_frequency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          subscription_tier?: 'free' | 'pro';
          subscription_status?: string;
          stripe_customer_id?: string | null;
          current_period_end?: string | null;
          tokens_remaining?: number;
          tokens_used_total?: number;
          last_token_grant?: string | null;
          stories_created?: number;
          words_generated?: number;
          onboarding_complete?: boolean | null;
          writing_goals?: string[] | null;
          preferred_genres?: string[] | null;
          experience_level?: string | null;
          writing_frequency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      stories: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          genre: string | null;
          premise: string | null;
          foundation: any | null;
          outline: any | null;
          characters: any;
          status: string;
          word_count: number;
          chapter_count: number;
          total_tokens_used: number;
          total_cost_usd: number;
          created_at: string;
          updated_at: string;
        };
      };
      chapters: {
        Row: {
          id: string;
          story_id: string;
          chapter_number: number;
          title: string | null;
          content: string | null;
          summary: string | null;
          word_count: number;
          tokens_used_input: number;
          tokens_used_output: number;
          generation_cost_usd: number;
          prompt_type: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      generation_logs: {
        Row: {
          id: string;
          user_id: string;
          story_id: string | null;
          chapter_id: string | null;
          operation_type: string;
          tokens_input: number;
          tokens_output: number;
          cost_usd: number;
          created_at: string;
        };
      };
      exports: {
        Row: {
          id: string;
          user_id: string;
          story_id: string;
          format: string;
          status: string;
          file_url: string | null;
          file_size_bytes: number | null;
          created_at: string;
          expires_at: string;
        };
      };
    };
  };
}