# Manual Humanizer

A small, fast browser app that helps you rewrite a piece of writing **sentence-by-sentence** so the final result feels naturally human — because you wrote it.

No build step, no backend, no signup. Open `index.html` and go.

## Features

- **Paste once, edit one sentence at a time** — paragraphs and sentence boundaries are detected automatically.
- **Original-vs-yours reference** — always see the original sentence above the editor.
- **Sentence list with progress bar** — jump between sentences; edited sentences are checkmarked.
- **Click-to-rephrase dictionary** — every word in the current sentence is a clickable chip. Click a word to see synonyms (powered by the free [Datamuse API](https://www.datamuse.com/api/) — no API key needed) and click a synonym to swap it in.
- **Auto-save to browser cache** — refresh-safe progress via `localStorage`.
- **Light & dark themes**.
- **Keyboard shortcuts**:
  - `Ctrl/⌘ + ←` previous sentence
  - `Ctrl/⌘ + →` save & next
  - `Ctrl/⌘ + R` reset current sentence to original
  - `Esc` close synonym popover
- **Export** — copy to clipboard or download as `.txt`.

## Run locally

Just open `index.html` in any modern browser. That's it.

```bash
open index.html      # macOS
xdg-open index.html  # Linux
start index.html     # Windows
```

Or run a simple static server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
.
├── index.html   # UI
├── styles.css   # Theme + layout
├── app.js       # Sentence parsing, editor logic, dictionary, cache
└── README.md
```

## How it works

1. Paste your full draft into the input area.
2. The app splits it into paragraphs (blank-line separated) and sentences.
3. You edit each sentence one at a time. Click any word to see synonyms; click a synonym to replace.
4. The final output is rebuilt automatically, preserving paragraph structure.
5. Copy or download when you're done.

## Privacy

Everything runs in your browser. Your text never leaves your device, except for individual word lookups sent to the public Datamuse API for synonyms.

## License

MIT
