/**
 * Performance optimization hooks
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// Debounce hook for performance optimization
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Throttle hook for limiting function calls
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const throttledCallback = useRef<T>()
  const lastExecuted = useRef<number>(0)

  const throttle = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastExecuted.current >= delay) {
        lastExecuted.current = now
        return callback(...args)
      }
    },
    [callback, delay]
  ) as T

  throttledCallback.current = throttle
  return throttledCallback.current
}

// Debounced search hook
export function useDebouncedSearch(
  searchTerm: string,
  searchFunction: (term: string) => void,
  delay: number = 300
) {
  const debouncedSearchTerm = useDebounce(searchTerm, delay)

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchFunction(debouncedSearchTerm)
    }
  }, [debouncedSearchTerm, searchFunction])

  return debouncedSearchTerm
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  targetRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsIntersecting(entry.isIntersecting)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    )

    observer.observe(target)

    return () => {
      observer.unobserve(target)
    }
  }, [targetRef, options])

  return isIntersecting
}

// Virtualization helper hook
export function useVirtualization<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    )

    return {
      startIndex: Math.max(0, startIndex - 1), // Buffer for smooth scrolling
      endIndex,
      visibleItems: items.slice(startIndex, endIndex)
    }
  }, [items, itemHeight, containerHeight, scrollTop])

  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    ...visibleRange,
    handleScroll,
    totalHeight: items.length * itemHeight
  }
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0)
  const lastRenderTime = useRef(performance.now())

  useEffect(() => {
    renderCount.current++
    const currentTime = performance.now()
    const timeSinceLastRender = currentTime - lastRenderTime.current

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName}:`, {
        renderCount: renderCount.current,
        timeSinceLastRender: Math.round(timeSinceLastRender * 100) / 100
      })
    }

    lastRenderTime.current = currentTime
  })

  return {
    renderCount: renderCount.current,
    reset: () => {
      renderCount.current = 0
      lastRenderTime.current = performance.now()
    }
  }
}

// Memory usage monitoring hook
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<any | null>(null)

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        setMemoryInfo((performance as any).memory)
      }
    }

    updateMemoryInfo()
    const interval = setInterval(updateMemoryInfo, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return memoryInfo
}

// Optimized event handler hook
export function useOptimizedEventHandler<T extends (...args: any[]) => void>(
  handler: T,
  dependencies: React.DependencyList
): T {
  return useCallback(handler, dependencies)
}

// Memoized value with dependencies
export function useOptimizedMemo<T>(
  factory: () => T,
  dependencies: React.DependencyList
): T {
  return useMemo(factory, dependencies)
}

// Component visibility tracking
export function useComponentVisibility() {
  const [isVisible, setIsVisible] = useState(false)
  const [wasVisible, setWasVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsVisible(entry.isIntersecting)
          if (entry.isIntersecting) {
            setWasVisible(true)
          }
        }
      },
      { threshold: 0.1 }
    )

    const element = ref.current
    if (element) {
      observer.observe(element)
    }

    return () => {
      if (element) {
        observer.unobserve(element)
      }
    }
  }, [])

  return { ref, isVisible, wasVisible }
}

// Resize observer hook
export function useResizeObserver<T extends HTMLElement>() {
  const [dimensions, setDimensions] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.unobserve(element)
    }
  }, [])

  return { ref, dimensions }
}

// Idle callback hook for non-critical updates
export function useIdleCallback(
  callback: () => void,
  dependencies: React.DependencyList
) {
  useEffect(() => {
    const handle = typeof requestIdleCallback !== 'undefined' ?
      requestIdleCallback(callback) :
      setTimeout(callback, 0)

    return () => {
      if (typeof requestIdleCallback !== 'undefined') {
        cancelIdleCallback(handle as number)
      } else {
        clearTimeout(handle as number)
      }
    }
  }, dependencies)
}