// Gemini sometimes wraps titles in markdown emphasis (*Klara and the Sun*)
// even in output meant to be pasted as plain text into Instagram/newsletter
// copy, where the asterisks would show up literally instead of rendering.
export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    // Underscore italics only at word boundaries — an unconstrained
    // /_(.+?)_/ also collapses multi-underscore hashtags and handles
    // (#cozy_autumn_reads, @river_side_books) that an Instagram caption
    // is meant to carry verbatim. Require the opening _ to follow start
    // or a non-word char and the closing _ to precede end or a non-word
    // char, with non-space just inside each.
    .replace(/(^|[^\w])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, "$1$2");
}
