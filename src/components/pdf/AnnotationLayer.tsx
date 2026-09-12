import React, { useState, useRef, useEffect } from "react";
import { PDFAnnotation } from "./types/annotation";
import { annotationService } from "./services/annotationService";

interface AnnotationLayerProps {
  width: number;
  height: number;
  pageNumber: number;
  annotations: PDFAnnotation[];
  activeTool: "pan" | "select" | "highlight" | "underline" | "strikethrough" | "drawing" | "rectangle" | "circle" | "arrow" | "eraser";
  activeColor: string;
  strokeThickness: number;
  strokeOpacity: number;
  onAddAnnotation: (ann: Omit<PDFAnnotation, "id" | "createdAt">) => void;
  onRemoveAnnotation: (id: string) => void;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  width,
  height,
  pageNumber,
  annotations,
  activeTool,
  activeColor,
  strokeThickness,
  strokeOpacity,
  onAddAnnotation,
  onRemoveAnnotation,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const isDrawingTool = activeTool === "drawing" || activeTool === "highlight" || activeTool === "underline" || activeTool === "rectangle" || activeTool === "circle" || activeTool === "arrow";
  const isEraserTool = activeTool === "eraser";

  if (activeTool === "pan" || activeTool === "select") return null;

  const getCoordinates = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);

    if (activeTool === "drawing") {
      setDrawingPoints([coords]);
    } else if (isDrawingTool) {
      setDragStart(coords);
      setDragCurrent(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === "drawing" && drawingPoints.length > 0) {
      const coords = getCoordinates(e);
      setDrawingPoints((prev) => [...prev, coords]);
    } else if (dragStart) {
      const coords = getCoordinates(e);
      setDragCurrent(coords);
    }
  };

  const handleMouseUp = () => {
    if (activeTool === "drawing" && drawingPoints.length > 1) {
      onAddAnnotation({
        pdfId: "", // will be set by hook
        page: pageNumber,
        type: "drawing",
        color: activeColor,
        points: drawingPoints,
        thickness: strokeThickness,
        opacity: strokeOpacity,
      });
      setDrawingPoints([]);
    } else if (dragStart && dragCurrent) {
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const w = Math.abs(dragStart.x - dragCurrent.x);
      const h = Math.abs(dragStart.y - dragCurrent.y);

      if (w > 2 || h > 2) {
        if (activeTool === "rectangle") {
          onAddAnnotation({
            pdfId: "",
            page: pageNumber,
            type: "rectangle",
            color: activeColor,
            coordinates: { x, y, w, h },
            thickness: strokeThickness,
            opacity: strokeOpacity,
          });
        } else if (activeTool === "circle") {
          onAddAnnotation({
            pdfId: "",
            page: pageNumber,
            type: "circle",
            color: activeColor,
            coordinates: { x, y, w, h },
            thickness: strokeThickness,
            opacity: strokeOpacity,
          });
        } else if (activeTool === "arrow") {
          onAddAnnotation({
            pdfId: "",
            page: pageNumber,
            type: "arrow",
            color: activeColor,
            points: [dragStart, dragCurrent],
            thickness: strokeThickness,
            opacity: strokeOpacity,
          });
        } else if (activeTool === "highlight") {
          onAddAnnotation({
            pdfId: "",
            page: pageNumber,
            type: "highlight",
            color: activeColor,
            coordinates: { x, y, w, h },
            thickness: strokeThickness,
            opacity: 0.35,
          });
        } else if (activeTool === "underline") {
          onAddAnnotation({
            pdfId: "",
            page: pageNumber,
            type: "underline",
            color: activeColor,
            coordinates: { x, y: dragStart.y, w, h: strokeThickness },
            thickness: strokeThickness,
            opacity: strokeOpacity,
          });
        }
      }

      setDragStart(null);
      setDragCurrent(null);
    }
  };

  const handleEraserClick = (annId: string, e: React.MouseEvent) => {
    if (!isEraserTool) return;
    e.stopPropagation();
    onRemoveAnnotation(annId);
  };

  return (
    <svg
      ref={svgRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`absolute top-0 left-0 z-40 select-none pointer-events-auto ${
        isEraserTool ? "cursor-cell" : "cursor-pencil"
      }`}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {/* Existing Annotations */}
      {annotations.map((ann) => {
        const style = annotationService.getAnnotationStyle(ann);
        
        // Highlight layer
        if (ann.type === "highlight" && ann.coordinates) {
          return (
            <rect
              key={ann.id}
              x={ann.coordinates.x}
              y={ann.coordinates.y}
              width={ann.coordinates.w}
              height={ann.coordinates.h}
              fill={ann.color}
              opacity={ann.opacity || 0.35}
              className={isEraserTool ? "hover:stroke-pink-500 hover:stroke-2 cursor-pointer" : ""}
              onClick={(e) => handleEraserClick(ann.id, e)}
            />
          );
        }

        // Underline / Strikethrough layer
        if ((ann.type === "underline" || ann.type === "strikethrough") && ann.coordinates) {
          const yPos = ann.type === "underline" 
            ? ann.coordinates.y + ann.coordinates.h 
            : ann.coordinates.y + ann.coordinates.h / 2;
          return (
            <line
              key={ann.id}
              x1={ann.coordinates.x}
              y1={yPos}
              x2={ann.coordinates.x + ann.coordinates.w}
              y2={yPos}
              stroke={ann.color}
              strokeWidth={ann.thickness || 3}
              opacity={ann.opacity || 0.8}
              className={isEraserTool ? "hover:stroke-pink-500 hover:stroke-4 cursor-pointer" : ""}
              onClick={(e) => handleEraserClick(ann.id, e)}
            />
          );
        }

        // Freehand drawings
        if (ann.type === "drawing" && ann.points) {
          const pathD = annotationService.pointsToSvgPath(ann.points);
          return (
            <path
              key={ann.id}
              d={pathD}
              stroke={ann.color}
              strokeWidth={ann.thickness || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={ann.opacity || 0.8}
              className={isEraserTool ? "hover:stroke-pink-500 hover:stroke-4 cursor-pointer" : ""}
              onClick={(e) => handleEraserClick(ann.id, e)}
            />
          );
        }

        // Geometric Rectangles
        if (ann.type === "rectangle" && ann.coordinates) {
          return (
            <rect
              key={ann.id}
              x={ann.coordinates.x}
              y={ann.coordinates.y}
              width={ann.coordinates.w}
              height={ann.coordinates.h}
              stroke={ann.color}
              strokeWidth={ann.thickness || 3}
              fill="none"
              opacity={ann.opacity || 0.8}
              className={isEraserTool ? "hover:stroke-pink-500 hover:stroke-4 cursor-pointer" : ""}
              onClick={(e) => handleEraserClick(ann.id, e)}
            />
          );
        }

        // Geometric Circles
        if (ann.type === "circle" && ann.coordinates) {
          const rx = ann.coordinates.w / 2;
          const ry = ann.coordinates.h / 2;
          return (
            <ellipse
              key={ann.id}
              cx={ann.coordinates.x + rx}
              cy={ann.coordinates.y + ry}
              rx={rx}
              ry={ry}
              stroke={ann.color}
              strokeWidth={ann.thickness || 3}
              fill="none"
              opacity={ann.opacity || 0.8}
              className={isEraserTool ? "hover:stroke-pink-500 hover:stroke-4 cursor-pointer" : ""}
              onClick={(e) => handleEraserClick(ann.id, e)}
            />
          );
        }

        // Sticky Notes
        if (ann.type === "sticky-note" && ann.coordinates) {
          return (
            <g
              key={ann.id}
              className="cursor-pointer group"
              onClick={(e) => {
                if (isEraserTool) {
                  handleEraserClick(ann.id, e);
                }
              }}
            >
              <rect
                x={ann.coordinates.x}
                y={ann.coordinates.y}
                width={26}
                height={26}
                rx={5}
                fill={ann.color || "#fef08a"}
                stroke="#ca8a04"
                strokeWidth={1.5}
                className="filter drop-shadow transition-transform hover:scale-110"
              />
              <path
                d={`M ${ann.coordinates.x + 7} ${ann.coordinates.y + 6} h 12 a 2 2 0 0 1 2 2 v 10 a 2 2 0 0 1 -2 2 h -12 a 2 2 0 0 1 -2 -2 v -10 a 2 2 0 0 1 2 -2 z M ${ann.coordinates.x + 7} ${ann.coordinates.y + 10} h 8 M ${ann.coordinates.x + 7} ${ann.coordinates.y + 14} h 5`}
                stroke="#854d0e"
                strokeWidth={1.2}
                fill="none"
                strokeLinecap="round"
              />
            </g>
          );
        }

        // Geometric Arrows
        if (ann.type === "arrow" && ann.points && ann.points.length >= 2 && ann.points[0] && ann.points[1]) {
          const p1 = ann.points[0];
          const p2 = ann.points[1];
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          
          // Arrowhead markers can be drawn inline
          const arrowLength = 10;
          const leftHeadX = p2.x - arrowLength * Math.cos(angle - Math.PI / 6);
          const leftHeadY = p2.y - arrowLength * Math.sin(angle - Math.PI / 6);
          const rightHeadX = p2.x - arrowLength * Math.cos(angle + Math.PI / 6);
          const rightHeadY = p2.y - arrowLength * Math.sin(angle + Math.PI / 6);

          return (
            <g
              key={ann.id}
              className={isEraserTool ? "hover:stroke-pink-500 cursor-pointer" : ""}
              onClick={(e) => handleEraserClick(ann.id, e)}
            >
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={ann.color}
                strokeWidth={ann.thickness || 3}
                opacity={ann.opacity || 0.8}
              />
              <path
                d={`M ${p2.x} ${p2.y} L ${leftHeadX} ${leftHeadY} M ${p2.x} ${p2.y} L ${rightHeadX} ${rightHeadY}`}
                stroke={ann.color}
                strokeWidth={ann.thickness || 3}
                fill="none"
                opacity={ann.opacity || 0.8}
              />
            </g>
          );
        }

        return null;
      })}

      {/* Live Drawing Freehand feedback */}
      {activeTool === "drawing" && drawingPoints.length > 1 && (
        <path
          d={annotationService.pointsToSvgPath(drawingPoints)}
          stroke={activeColor}
          strokeWidth={strokeThickness}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={strokeOpacity}
        />
      )}

      {/* Live Drag Feedback (Arrows, Shapes) */}
      {dragStart && dragCurrent && (
        <>
          {activeTool === "rectangle" && (
            <rect
              x={Math.min(dragStart.x, dragCurrent.x)}
              y={Math.min(dragStart.y, dragCurrent.y)}
              width={Math.abs(dragStart.x - dragCurrent.x)}
              height={Math.abs(dragStart.y - dragCurrent.y)}
              stroke={activeColor}
              strokeWidth={strokeThickness}
              fill="none"
              opacity={strokeOpacity}
            />
          )}

          {activeTool === "circle" && (
            <ellipse
              cx={dragStart.x + (dragCurrent.x - dragStart.x) / 2}
              cy={dragStart.y + (dragCurrent.y - dragStart.y) / 2}
              rx={Math.abs(dragCurrent.x - dragStart.x) / 2}
              ry={Math.abs(dragCurrent.y - dragStart.y) / 2}
              stroke={activeColor}
              strokeWidth={strokeThickness}
              fill="none"
              opacity={strokeOpacity}
            />
          )}

          {activeTool === "arrow" && (
            <g>
              <line
                x1={dragStart.x}
                y1={dragStart.y}
                x2={dragCurrent.x}
                y2={dragCurrent.y}
                stroke={activeColor}
                strokeWidth={strokeThickness}
                opacity={strokeOpacity}
              />
            </g>
          )}

          {activeTool === "highlight" && (
            <rect
              x={Math.min(dragStart.x, dragCurrent.x)}
              y={Math.min(dragStart.y, dragCurrent.y)}
              width={Math.abs(dragStart.x - dragCurrent.x)}
              height={Math.abs(dragStart.y - dragCurrent.y)}
              fill={activeColor}
              opacity={0.35}
            />
          )}

          {activeTool === "underline" && (
            <line
              x1={Math.min(dragStart.x, dragCurrent.x)}
              y1={dragStart.y}
              x2={Math.max(dragStart.x, dragCurrent.x)}
              y2={dragStart.y}
              stroke={activeColor}
              strokeWidth={strokeThickness}
              opacity={strokeOpacity}
            />
          )}
        </>
      )}
    </svg>
  );
};
