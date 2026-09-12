import React, { useState, useRef } from "react";

interface SelectionLayerProps {
  width: number;
  height: number;
  pageNumber: number;
  isActive: boolean;
  onSelectionComplete: (
    rect: { x: number; y: number; w: number; h: number; page: number },
    position: { x: number; y: number; pageX: number; pageY: number }
  ) => void;
}

export const SelectionLayer: React.FC<SelectionLayerProps> = ({
  width,
  height,
  pageNumber,
  isActive,
  onSelectionComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  if (!isActive) return null;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    setStartPos({ x, y });
    setCurrentPos({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!startPos) return;
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    setCurrentPos({ x, y });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!startPos || !currentPos) return;

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(startPos.x - currentPos.x);
    const h = Math.abs(startPos.y - currentPos.y);

    if (w > 10 && h > 10) {
      onSelectionComplete(
        { x, y, w, h, page: pageNumber },
        { x: x + w / 2, y, pageX: e.pageX, pageY: e.pageY }
      );
    }

    setStartPos(null);
    setCurrentPos(null);
  };

  const getSelectionStyles = () => {
    if (!startPos || !currentPos) return null;
    const left = Math.min(startPos.x, currentPos.x);
    const top = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(startPos.x - currentPos.x);
    const h = Math.abs(startPos.y - currentPos.y);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${w}px`,
      height: `${h}px`,
    };
  };

  const styles = getSelectionStyles();

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="absolute top-0 left-0 cursor-crosshair z-30 select-none pointer-events-auto"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {styles && (
        <div
          className="absolute border-2 border-dashed border-purple-500 bg-purple-500/10 pointer-events-none rounded"
          style={styles}
        />
      )}
    </div>
  );
};
