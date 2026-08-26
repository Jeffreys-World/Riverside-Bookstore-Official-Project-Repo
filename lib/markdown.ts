// Gemini sometimes wraps titles in markdown emphasis (*Klara and the Sun*)
// even in output meant to be pasted as plain text into Instagram/newsletter
// copy, where the asterisks would show up literally instead of rendering.
export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1");
}
