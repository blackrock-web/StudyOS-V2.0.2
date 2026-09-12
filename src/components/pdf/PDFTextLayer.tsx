import React, { useEffect, useRef } from "react";

interface PDFTextLayerProps {
  page: any;
  viewport: any;
  searchQuery?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  isRegex?: boolean;
}

export const PDFTextLayer: React.FC<PDFTextLayerProps> = ({
  page,
  viewport,
  searchQuery = "",
  caseSensitive = false,
  wholeWord = false,
  isRegex = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!page || !containerRef.current) return;

    let active = true;
    const renderText = async () => {
      try {
        const textContent = await page.getTextContent();
        if (!active || !containerRef.current) return;

        // Safe clear — no innerHTML assignment of untrusted content
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }

        const pdfjsLib = (window as unknown as { pdfjsLib?: { Util: { transform: (a: unknown, b: unknown) => number[] } } }).pdfjsLib;
        if (!pdfjsLib) {
          console.warn("pdfjsLib is not loaded on window.");
          return;
        }

        const escapeRegex = (str: string) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

        let regex: RegExp | null = null;
        if (searchQuery.trim()) {
          try {
            // Never treat user input as unbounded ReDoS: cap length
            const q = searchQuery.slice(0, 200);
            let pattern = isRegex ? q : escapeRegex(q);
            if (wholeWord) {
              pattern = `\\b${pattern}\\b`;
            }
            regex = new RegExp(pattern, caseSensitive ? "g" : "gi");
          } catch (e) {
            console.warn("Invalid highlight regex:", e);
          }
        }

        textContent.items.forEach((item: { str?: string; transform?: unknown; width?: number }) => {
          const tx = pdfjsLib.Util.transform(
            viewport.transform,
            item.transform
          );
          const fontHeight = Math.sqrt(tx[2]! * tx[2]! + tx[3]! * tx[3]!);

          const div = document.createElement("span");
          div.style.position = "absolute";
          div.style.left = `${tx[4]}px`;
          div.style.top = `${tx[5]! - fontHeight}px`;
          div.style.fontSize = `${fontHeight}px`;
          div.style.fontFamily = "sans-serif";
          div.style.color = "transparent";
          div.style.transform = `scaleX(${(item.width || fontHeight) / fontHeight})`;
          div.style.transformOrigin = "0 0";
          div.style.whiteSpace = "pre";

          const text = String(item.str ?? "");

          if (regex && text.trim()) {
            regex.lastIndex = 0;
            let lastIndex = 0;
            let match: RegExpExecArray | null;
            let hasMatch = false;
            // Build highlights with text nodes + safe mark elements (no innerHTML)
            const frag = document.createDocumentFragment();
            while ((match = regex.exec(text)) !== null) {
              hasMatch = true;
              if (match.index > lastIndex) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
              }
              const mark = document.createElement("mark");
              mark.style.backgroundColor = "rgba(253, 224, 71, 0.95)";
              mark.style.color = "#1e293b";
              mark.style.padding = "1px 0";
              mark.style.borderRadius = "2px";
              mark.style.fontWeight = "800";
              mark.style.mixBlendMode = "multiply";
              mark.textContent = match[0];
              frag.appendChild(mark);
              lastIndex = match.index + match[0].length;
              if (match[0].length === 0) {
                regex.lastIndex++;
              }
            }
            if (hasMatch) {
              if (lastIndex < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex)));
              }
              div.appendChild(frag);
            } else {
              div.textContent = text;
            }
          } else {
            div.textContent = text;
          }

          containerRef.current?.appendChild(div);
        });
      } catch (err) {
        console.error("Failed to render text layer:", err);
      }
    };

    renderText();

    return () => {
      active = false;
    };
  }, [page, viewport, searchQuery, caseSensitive, wholeWord, isRegex]);

  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0 right-0 bottom-0 pointer-events-auto select-text textLayer overflow-hidden"
      style={{
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
        opacity: 0.95, // Increased opacity so highlighted spans are fully visible!
      }}
    />
  );
};
