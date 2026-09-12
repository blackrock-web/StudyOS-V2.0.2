import { PDFAnnotation } from "../types/annotation";

class AnnotationService {
  /**
   * Converts a series of coordinate points into a smooth SVG path d-attribute string.
   */
  public pointsToSvgPath(points: { x: number; y: number }[]): string {
    if (points.length === 0 || !points[0]) return "";
    const p0 = points[0];
    if (points.length === 1) return `M ${p0.x} ${p0.y} L ${p0.x} ${p0.y}`;

    let path = `M ${p0.x} ${p0.y}`;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p) {
        path += ` L ${p.x} ${p.y}`;
      }
    }
    return path;
  }

  /**
   * Returns a standard styling configuration for specific annotation types
   */
  public getAnnotationStyle(annotation: PDFAnnotation) {
    const defaultColor = annotation.color || "#a855f7";
    const thickness = annotation.thickness || 3;
    const opacity = annotation.opacity !== undefined ? annotation.opacity : 0.8;

    switch (annotation.type) {
      case "highlight":
        return {
          fill: defaultColor,
          fillOpacity: 0.3,
          stroke: "none",
        };
      case "underline":
        return {
          stroke: defaultColor,
          strokeWidth: thickness,
          strokeOpacity: opacity,
          fill: "none",
        };
      case "strikethrough":
        return {
          stroke: defaultColor,
          strokeWidth: thickness,
          strokeOpacity: opacity,
          fill: "none",
        };
      case "drawing":
        return {
          stroke: defaultColor,
          strokeWidth: thickness,
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
          strokeOpacity: opacity,
          fill: "none",
        };
      default:
        return {
          stroke: defaultColor,
          strokeWidth: thickness,
          strokeOpacity: opacity,
          fill: "none",
        };
    }
  }
}

export const annotationService = new AnnotationService();
