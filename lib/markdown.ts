// Gemini sometimes wraps titles in markdown emphasis (*Klara and the Sun*)
// even in output meant to be pasted as plain text into Instagram/newsletter
// copy, where the asterisks would show up literally instead of rendering.
export function stripMarkdownEmphasis(text: string): string {
  return text
    // Asterisk emphasis under the same word-boundary constraint as the
    // underscore rule below: the marker must open on a non-space and
    // close on a non-space, and must not be glued to a word character on
    // the outside. An unconstrained /\*(.+?)\*/ ate any two literal
    // asterisks on one line — a `* bullet` list, "2 * 3 * 4", a
    // "free tote * one per customer *" footnote — all of which a caption
    // is meant to carry verbatim.
    .replace(/(^|[^\w*])\*\*(?=\S)(.+?)(?<=\S)\*\*(?!\w)/g, "$1$2")
    .replace(/(^|[^\w*])\*(?=\S)(.+?)(?<=\S)\*(?!\w)/g, "$1$2")
    // Underscore italics only at word boundaries — an unconstrained
    // /_(.+?)_/ also collapses multi-underscore hashtags and handles
    // (#cozy_autumn_reads, @river_side_books) that an Instagram caption
    // is meant to carry verbatim. Require the opening _ to follow start
    // or a non-word char and the closing _ to precede end or a non-word
    // char, with non-space just inside each.
    .replace(/(^|[^\w])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, "$1$2");
}
