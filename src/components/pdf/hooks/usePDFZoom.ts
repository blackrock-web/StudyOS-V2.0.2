import { useState } from "react";

export function usePDFZoom(initialZoom = 1.5) {
  const [zoom, setZoom] = useState(initialZoom);

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 4.0));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const setExactZoom = (value: number) => setZoom(value);

  return { zoom, zoomIn, zoomOut, setExactZoom };
}
