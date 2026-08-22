import { useCallback, useEffect, useRef, useState } from "react";

const OVERSCAN = 6;

/**
 * Minimal fixed-row-height virtualization for the request list. Renders only
 * the rows inside the visible viewport plus an overscan buffer.
 */
export function useVirtualList(count: number, rowHeight: number) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setViewportHeight(h);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const end = Math.min(
    count,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN
  );

  return {
    containerRef: ref,
    onScroll,
    start,
    end,
    offsetY: start * rowHeight,
    totalHeight: count * rowHeight,
    rowHeight,
  };
}