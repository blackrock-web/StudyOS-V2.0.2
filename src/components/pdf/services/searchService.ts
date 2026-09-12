export interface SearchMatch {
  page: number;
  text: string;
  index: number;
  length?: number;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  isRegex: boolean;
}

class SearchService {
  /**
   * Performs text-search across all pages of a loaded PDF document.
   */
  public async searchDocument(
    pdfDocument: any,
    query: string,
    options: SearchOptions
  ): Promise<SearchMatch[]> {
    if (!pdfDocument || !query.trim()) return [];

    const matches: SearchMatch[] = [];
    const totalPages = pdfDocument.numPages;

    // Build the matching regex based on user options
    let regex: RegExp;
    try {
      let pattern = "";
      if (options.isRegex) {
        pattern = query;
      } else {
        // Escape standard string query characters for regex
        pattern = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      }

      if (options.wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }

      const flags = options.caseSensitive ? "g" : "gi";
      regex = new RegExp(pattern, flags);
    } catch (err) {
      console.warn("Invalid search regex pattern, falling back to simple search:", err);
      // Fallback simple regex
      regex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "gi");
    }

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items with space separators
        const textItems = textContent.items.map((item: any) => item.str);
        const pageText = textItems.join(" ");

        let match;
        // reset regex index
        regex.lastIndex = 0;

        // Loop to find all matches in the page
        while ((match = regex.exec(pageText)) !== null) {
          const index = match.index;
          const matchedText = match[0];

          // Extract surrounding snippet
          const contextStart = Math.max(0, index - 40);
          const contextEnd = Math.min(pageText.length, index + matchedText.length + 40);
          
          let snippet = pageText.substring(contextStart, contextEnd);
          if (contextStart > 0) snippet = "..." + snippet;
          if (contextEnd < pageText.length) snippet = snippet + "...";

          matches.push({
            page: pageNum,
            text: snippet.trim(),
            index,
            length: matchedText.length,
          });

          // Prevent infinite loops with empty regex matches
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }
      } catch (err) {
        console.error(`Error searching page ${pageNum}:`, err);
      }
    }

    return matches;
  }
}

export const searchService = new SearchService();
