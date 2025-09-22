/**
 * Comprehensive component prop types and interfaces
 */

import type { ReactNode } from 'react'
import type { ComponentProps, HTMLAttributes } from 'react'
import type { Profile, Story, Chapter, CreatorEarning } from './database'
import type { SubscriptionTier } from '@/lib/subscription-config'

// Base component props
export interface BaseComponentProps {
  className?: string
  children?: ReactNode
  'data-testid'?: string
}

// User profile types for components
export interface UserProfile {
  id: string
  email: string
  full_name?: string
  subscription_tier: SubscriptionTier
  tokens_remaining: number
  tokens_used_total?: number
  tokens_saved_cache?: number
  stories_created?: number
  credits_balance?: number
  is_creator?: boolean
  is_admin?: boolean
  avatar_url?: string
  created_at?: string
  onboarding_complete?: boolean
}

// Unified user profile (combining different profile shapes)
export interface UnifiedUserProfile {
  id: string
  email: string
  full_name?: string
  subscription_tier: 'free' | 'basic' | 'premium' | 'pro'
  tokens_remaining: number
  tokens_used_total: number
  tokens_saved_cache?: number
  credits_balance?: number
  stories_created: number
  words_generated?: number
  is_creator?: boolean
  is_admin?: boolean
  avatar_url?: string
  current_period_end?: string
  onboarding_complete?: boolean
}

// Story-related component props
export interface StoryCardProps extends BaseComponentProps {
  story: Story
  onEdit?: (story: Story) => void
  onDelete?: (storyId: string) => void
  onView?: (story: Story) => void
  onPublish?: (story: Story) => void
  showActions?: boolean
  compact?: boolean
}

export interface StoryListProps extends BaseComponentProps {
  stories: Story[]
  loading?: boolean
  onStorySelect?: (story: Story) => void
  onCreateNew?: () => void
  filters?: StoryFilters
  onFiltersChange?: (filters: StoryFilters) => void
  sortBy?: string
  onSortChange?: (sortBy: string) => void
  searchTerm?: string
  onSearchChange?: (term: string) => void
}

export interface StoryCreatorProps extends BaseComponentProps {
  userProfile: UserProfile
  defaultMode?: 'story' | 'novel' | 'choice-book' | 'ai-builder'
  storyId?: string
  onStoryCreated?: (story: Story) => void
  onCancel?: () => void
}

export interface StoryFilters {
  genre?: string
  status?: string
  search?: string
  dateRange?: {
    start: string
    end: string
  }
}

// Analytics component props
export interface AnalyticsChartProps extends BaseComponentProps {
  data: Array<{
    label: string
    value: number
    [key: string]: string | number
  }>
  type: 'line' | 'bar' | 'pie' | 'area'
  title?: string
  loading?: boolean
  error?: string
}

export interface MetricCardProps extends BaseComponentProps {
  title: string
  value: string | number
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
  icon?: ReactNode
  description?: string
  loading?: boolean
}

// Dashboard component props
export interface DashboardTabProps extends BaseComponentProps {
  userProfile: UnifiedUserProfile
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export interface SidebarItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  href?: string
  onClick?: () => void
  badge?: string | number
  disabled?: boolean
}

export interface SidebarProps extends BaseComponentProps {
  items: SidebarItem[]
  activeItem?: string
  onItemClick?: (itemId: string) => void
  collapsible?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
}

// Form component props
export interface FormFieldProps extends BaseComponentProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
  helpText?: string
  value?: string | number
  onChange?: (value: string | number) => void
  options?: Array<{ label: string; value: string | number }>
}

export interface FormProps extends BaseComponentProps {
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>
  loading?: boolean
  disabled?: boolean
  submitText?: string
  resetText?: string
  showReset?: boolean
  validation?: Record<string, (value: unknown) => string | undefined>
}

// Modal and dialog props
export interface ModalProps extends BaseComponentProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closable?: boolean
  footer?: ReactNode
  loading?: boolean
}

export interface ConfirmDialogProps extends BaseComponentProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

// Table component props
export interface TableColumn<T = Record<string, unknown>> {
  key: keyof T
  title: string
  dataIndex?: keyof T
  render?: (value: unknown, record: T, index: number) => ReactNode
  sortable?: boolean
  width?: string | number
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'
}

export interface TableProps<T = Record<string, unknown>> extends BaseComponentProps {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  pagination?: {
    current: number
    pageSize: number
    total: number
    onChange: (page: number, pageSize: number) => void
  }
  rowKey?: keyof T | ((record: T) => string)
  onRowClick?: (record: T, index: number) => void
  selectedRows?: T[]
  onRowSelect?: (selectedRows: T[]) => void
  expandable?: {
    expandedRowRender: (record: T) => ReactNode
    rowExpandable?: (record: T) => boolean
  }
}

// Creator earnings component props
export interface CreatorEarningsProps extends BaseComponentProps {
  userProfile: UserProfile
  timeRange?: string
  onTimeRangeChange?: (range: string) => void
}

export interface EarningsChartProps extends BaseComponentProps {
  data: CreatorEarning[]
  timeRange: string
  loading?: boolean
}

export interface PayoutHistoryProps extends BaseComponentProps {
  payouts: Array<{
    id: string
    amount: number
    status: string
    date: string
    description?: string
  }>
  loading?: boolean
  onRequestPayout?: () => void
}

// Premium upgrade component props
export interface PremiumUpgradeProps extends BaseComponentProps {
  userProfile: UserProfile
  onClose?: () => void
  onUpgrade?: (tier: SubscriptionTier) => void
  showComparison?: boolean
  highlightFeatures?: string[]
}

// Error boundary component props
export interface ErrorBoundaryProps extends BaseComponentProps {
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  showDetails?: boolean
  level?: 'page' | 'section' | 'component'
}

// Loading component props
export interface LoadingProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'spinner' | 'skeleton' | 'pulse'
  message?: string
  overlay?: boolean
}

export interface SkeletonProps extends BaseComponentProps {
  width?: string | number
  height?: string | number
  rounded?: boolean
  animated?: boolean
  lines?: number
}

// Notification/Toast props
export interface NotificationProps extends BaseComponentProps {
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
  closable?: boolean
  onClose?: () => void
  action?: {
    label: string
    onClick: () => void
  }
}

// Search and filter component props
export interface SearchBarProps extends BaseComponentProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  suggestions?: string[]
  onSuggestionSelect?: (suggestion: string) => void
  loading?: boolean
  debounceMs?: number
}

export interface FilterPanelProps extends BaseComponentProps {
  filters: Record<string, unknown>
  onFiltersChange: (filters: Record<string, unknown>) => void
  options: Array<{
    key: string
    label: string
    type: 'select' | 'multiselect' | 'date' | 'range' | 'checkbox'
    options?: Array<{ label: string; value: string | number }>
    placeholder?: string
  }>
  onReset?: () => void
  showReset?: boolean
}

// Layout component props
export interface LayoutProps extends BaseComponentProps {
  sidebar?: ReactNode
  header?: ReactNode
  footer?: ReactNode
  sidebarCollapsed?: boolean
  onSidebarToggle?: () => void
}

export interface HeaderProps extends BaseComponentProps {
  user?: UserProfile
  onSignOut?: () => void
  showUserMenu?: boolean
  notifications?: Array<{
    id: string
    type: string
    message: string
    read: boolean
    timestamp: string
  }>
  onNotificationClick?: (notificationId: string) => void
}

// Animation and transition props
export interface AnimationProps {
  duration?: number
  delay?: number
  easing?: string
  direction?: 'normal' | 'reverse' | 'alternate'
  fillMode?: 'forwards' | 'backwards' | 'both' | 'none'
}

export interface TransitionProps extends BaseComponentProps {
  show: boolean
  appear?: boolean
  enter?: string
  enterFrom?: string
  enterTo?: string
  leave?: string
  leaveFrom?: string
  leaveTo?: string
  duration?: number
}

// Utility types for component development
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ComponentVariant = 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost'
export type ComponentState = 'default' | 'loading' | 'error' | 'success' | 'disabled'

// Higher-order component types
export interface WithLoadingProps {
  loading: boolean
}

export interface WithErrorProps {
  error?: Error | string
  onRetry?: () => void
}

export interface WithAuthProps {
  user: UserProfile
  isAuthenticated: boolean
}

// Event handler types
export type ClickHandler = (event: React.MouseEvent<HTMLElement>) => void
export type ChangeHandler<T = string> = (value: T) => void
export type SubmitHandler<T = Record<string, unknown>> = (data: T) => void | Promise<void>
export type KeyPressHandler = (event: React.KeyboardEvent<HTMLElement>) => void

// Ref types for component imperative APIs
export interface ModalRef {
  open: () => void
  close: () => void
  toggle: () => void
}

export interface FormRef {
  submit: () => void
  reset: () => void
  validate: () => boolean
  getValues: () => Record<string, unknown>
  setValues: (values: Record<string, unknown>) => void
}