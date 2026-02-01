# Calendar MVP Plugin - Local Testing Guide

This guide explains how to build and test the plugin locally in Obsidian.

## Prerequisites

- Node.js 18+ (for esbuild and TypeScript).
- Obsidian desktop app.

## 1. Install dependencies

```bash
npm install
```

## 2. Build the plugin

```bash
npm run build
```

The build output is written to `dist/main.js`.

## 3. Copy files into your Obsidian vault

Create a plugin folder in your vault (replace `<vault>` with your vault path):

```
<vault>/.obsidian/plugins/obsidian-calendar-mvp/
```

Copy the following files into it (place them at the plugin folder root):

- `manifest.json`
- `dist/main.js` → rename to `main.js`

Optional (for debugging):

- `dist/main.js.map` (if present)

## 4. Enable the plugin in Obsidian

1. Open **Settings → Community Plugins**.
2. Turn off **Safe mode** if needed.
3. Find **Calendar MVP** and enable it.

## 5. Configure the iCal URL

1. Go to **Settings → Calendar MVP**.
2. Paste your private Google Calendar iCal URL.
3. Re-open the Calendar view or hit **Refresh**.

## 6. Open the Calendar view

Use any of these:

- Ribbon icon (calendar).
- Command palette:
  - **Open calendar**
  - **Jump to today**
  - **Refresh calendar**

## 7. Development watch mode (optional)

```bash
npm run dev
```

This watches for changes and rebuilds `dist/main.js` automatically.

After a rebuild, reload Obsidian (Ctrl/Cmd + R) to see updates.
