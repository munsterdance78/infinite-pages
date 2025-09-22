import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'glass-btn inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 glass-text-shadow',
  {
    variants: {
      variant: {
        default: 'glass-btn-primary text-white hover:scale-105 focus-visible:glass-focus',
        destructive:
          'glass-base border-red-500/30 bg-gradient-to-r from-red-500/20 to-red-600/20 text-white hover:from-red-500/30 hover:to-red-600/30 hover:border-red-500/40',
        outline:
          'glass-base border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30',
        secondary:
          'glass-btn-secondary text-white hover:scale-105',
        ghost: 'text-white hover:glass-base hover:bg-white/10 rounded-md',
        link: 'text-blue-300 underline-offset-4 hover:underline hover:text-blue-200 glass-text-shadow-subtle'
      },
      size: {
        default: 'min-h-[44px] px-6 py-3',
        sm: 'min-h-[40px] px-4 py-2 text-sm',
        lg: 'min-h-[48px] px-8 py-4 text-base',
        icon: 'min-h-[44px] min-w-[44px] p-3'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }