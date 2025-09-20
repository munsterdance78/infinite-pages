import type { Database } from '@/lib/supabase/types'
import type { StoryStatus } from '@/lib/constants'

// Shared types to ensure consistency across components
export type Chapter = Database['public']['Tables']['chapters']['Row'];

export type Story = Database['public']['Tables']['stories']['Row'] & {
  chapters?: Chapter[];
};

// For compatibility with existing code that expects StoryStatus
export type StoryWithStatus = Omit<Story, 'status'> & {
  status: StoryStatus;
};