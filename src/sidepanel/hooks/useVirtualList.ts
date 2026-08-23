import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const OVERSCAN = 6;

/** One layable unit in the virtualized list. Heights may vary per item. */
export interface VirtualItem {
  id: string;
  height: number;
}

export interface VisibleItem<T> {
  item: T;
  /** Absolute top offset inside the scroll spacer. */
  top: number;
}

/**
 * Minimal virtualization for the request list with variable-height items
 * (rows plus group headers). Renders only the items inside the visible
 * viewport plus an overscan buffer; positions are absolute so mixed heights
 * never reflow the window.
 */
export function useVirtualList<T extends VirtualItem>(items: T[]) {
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

  // Prefix sums of item heights: offsets[i] is the top edge of item i,
  // offsets[items.length] the total content height.
  const offsets = useMemo(() => {
    const out = new Array<number>(items.length + 1);
    out[0] = 0;
    for (let i = 0; i < items.length; i += 1) {
      out[i + 1] = out[i]! + Math.max(0, items[i]!.height);
    }
    return out;
  }, [items]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = offsets[items.length] ?? 0;

  // Binary search: last item whose top edge is at or above the scroll line.
  let start = 0;
  {
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((offsets[mid] ?? 0) <= scrollTop) lo = mid;
      else hi = mid - 1;
    }
    start = lo;
  }

  let end = start;
  const bottom = scrollTop + viewportHeight;
  while (
    end < items.length &&
    (offsets[end] ?? totalHeight) < bottom
  ) {
    end += 1;
  }
  end = Math.min(items.length, end + OVERSCAN);
  start = Math.max(0, start - OVERSCAN);

  const visible: VisibleItem<T>[] = [];
  for (let i = start; i < end; i += 1) {
    visible.push({ item: items[i]!, top: offsets[i] ?? 0 });
  }

  return {
    containerRef: ref,
    onScroll,
    visible,
    totalHeight,
  };
}
