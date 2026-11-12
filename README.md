# aaloe-lyzer

Chat statistics for Instagram and WhatsApp exports. Combine alternate accounts into groups and explore message activity, sender balance, reply times, and conversation patterns.

**[Open aaloe-lyzer](https://aaloe-lyzer.vercel.app/)**

## Versions

- `main`: the current React and TypeScript application.
- [`streamlit-python`](https://github.com/Aarav404/instagram-chat-analyzer/tree/streamlit-python): the original Python and Streamlit application.
- [Releases](https://github.com/Aarav404/instagram-chat-analyzer/releases): version notes and source downloads.

## Run

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://127.0.0.1:5173/`).

## Build

```sh
npm run build
npm run preview
```

## Development

This branch runs on Node.js; Python and Streamlit are not required.
The original application is preserved on the `streamlit-python` branch and in Git history.

`npm test` uses saved synthetic outputs from the original Python implementation.
The optional `scripts/validate-legacy.ts` tool reads that implementation from Git
history to regenerate the reference outputs; only that developer tool needs Python.
