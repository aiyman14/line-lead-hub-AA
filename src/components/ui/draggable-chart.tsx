import { useRef, useCallback, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DraggableChartProps {
  children: ReactNode;
  /** Current Y-axis domain [min, max] */
  yDomain: [number, number];
  /** Called with new [min, max] while dragging */
  onYDomainChange: (domain: [number, number]) => void;
  /** Reset to auto domain */
  onReset: () => void;
  /** Height of the chart area in px (used to calculate drag ratio) */
  chartHeight?: number;
  /** Width in px of the Y-axis click zone from the left edge */
  yAxisWidth?: number;
  className?: string;
  /** Has the user changed the domain from auto? */
  isCustom?: boolean;
}

export function DraggableChart({
  children,
  yDomain,
  onYDomainChange,
  onReset,
  chartHeight = 300,
  yAxisWidth = 55,
  className,
  isCustom = false,
}: DraggableChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startY: number;
    startDomain: [number, number];
    axis: "y" | "x";
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cursorZone, setCursorZone] = useState<"y" | "x" | null>(null);

  const getZone = useCallback(
    (clientX: number): "y" | "x" | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      // Bottom 40px is roughly the X-axis label area
      if (relX <= yAxisWidth) return "y";
      return null;
    },
    [yAxisWidth]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const zone = getZone(e.clientX);
      if (!zone) return;

      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        startY: e.clientY,
        startDomain: [...yDomain],
        axis: zone,
      };
      setIsDragging(true);
    },
    [yDomain, getZone]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Update cursor zone for visual feedback
      if (!isDragging) {
        const zone = getZone(e.clientX);
        setCursorZone(zone);
      }

      if (!dragState.current || !isDragging) return;
      e.preventDefault();

      const dy = e.clientY - dragState.current.startY;
      const range = dragState.current.startDomain[1] - dragState.current.startDomain[0];
      // Dragging up (negative dy) → shift domain up, dragging down → shift down
      const shift = (dy / chartHeight) * range;

      const newMin = Math.max(0, dragState.current.startDomain[0] + shift);
      const newMax = dragState.current.startDomain[1] + shift;

      if (newMax > newMin) {
        onYDomainChange([Math.round(newMin), Math.round(newMax)]);
      }
    },
    [isDragging, chartHeight, onYDomainChange, getZone]
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const zone = getZone(e.clientX);
      if (zone !== "y") return;
      e.preventDefault();

      const range = yDomain[1] - yDomain[0];
      const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87; // scroll down = zoom out
      const newRange = Math.max(100, range * zoomFactor);
      const center = (yDomain[0] + yDomain[1]) / 2;
      const newMin = Math.max(0, Math.round(center - newRange / 2));
      const newMax = Math.round(center + newRange / 2);

      onYDomainChange([newMin, newMax]);
    },
    [yDomain, onYDomainChange, getZone]
  );

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className={cn(
          "touch-none select-none",
          cursorZone === "y" && !isDragging && "cursor-ns-resize",
          isDragging && "cursor-grabbing"
        )}
      >
        {children}
      </div>
      {isCustom && (
        <Button
          variant="outline"
          size="sm"
          className="absolute top-1 right-1 h-6 px-2 text-[10px] gap-1 opacity-70 hover:opacity-100 z-10"
          onClick={onReset}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      )}
    </div>
  );
}
