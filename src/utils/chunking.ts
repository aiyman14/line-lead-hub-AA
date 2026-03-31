// Client-side text chunking for knowledge base ingestion

const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

export interface TextChunk {
  content: string;
  index: number;
  sectionHeading: string | null;
}

/**
 * Split text into overlapping chunks.
 * Uses a simple for-loop with a guaranteed step size — cannot infinite-loop.
 */
export function chunkText(text: string): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: TextChunk[] = [];
  const step = CHUNK_SIZE - CHUNK_OVERLAP; // 800 chars forward per iteration

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        index: chunks.length,
        sectionHeading: extractSectionHeading(content),
      });
    }

    // If we've reached the end, stop
    if (end >= text.length) break;
  }

  return chunks;
}

function extractSectionHeading(text: string): string | null {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 0 &&
      trimmed.length < 100 &&
      (trimmed.startsWith("#") ||
        trimmed.toUpperCase() === trimmed ||
        /^[A-Z][^.!?]*$/.test(trimmed))
    ) {
      return trimmed.replace(/^#+\s*/, "");
    }
  }
  return null;
}
