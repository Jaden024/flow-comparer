# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flow Comparer is a desktop application built with Tauri for comparing HTTP Archive (HAR) files. It provides a visual interface to analyze and compare network requests between different HAR files, useful for debugging, testing, and analyzing API changes.

**Tech Stack:**
- Frontend: React 19 + TypeScript + Vite
- Backend: Rust + Tauri 2
- Key Libraries: react-diff-viewer-continued for diff visualization

## Development Commands

### Development
```bash
npm run tauri dev
```
Starts both the Vite dev server (port 1420) and Tauri backend with hot reload enabled.

### Building
```bash
npm run tauri build
```
Creates production build with installer and portable executable in `src-tauri/target/release/bundle/`.

### Frontend Only
```bash
npm run dev        # Start Vite dev server only
npm run build      # Build frontend only (TypeScript + Vite)
```

## Architecture

### Frontend Architecture (React/TypeScript)

**Main Components:**
- `src/App.tsx` - Main application with side-by-side HAR file comparison UI
- `src/Comparison.tsx` - Standalone detailed comparison view (secondary entry point)
- `src/main.tsx` - Primary entry point
- `src/comparison-main.tsx` - Secondary entry point for comparison window

**State Management:**
- All state is local React state (useState)
- No global state management library
- Refs used for synchronized scrolling between panels

**Key Features Implemented:**
1. **Request Alignment**: Two modes via `alignRequests` checkbox
   - Standard alignment: Groups similar requests by URL path
   - One-to-one alignment: Strict pairing with empty placeholders
2. **Auto-Selection**: Selecting a request in one panel automatically selects corresponding request in other panel (based on HTML list position, not request index)
3. **Synchronized Scrolling**: Optional linked scrolling between panels
4. **Index-Based Navigation**: Jump to specific request by its index number
5. **Detailed Comparison Modal**: Multi-tab view showing headers, payloads, parameters, and responses with professional diff visualization

**Important Implementation Details:**
- Request indices start from 1 (not 0) for user-friendly display
- GET requests are matched by path only (query params excluded from alignment)
- The `htmlListIndex` (position in displayed list) differs from `request.index` when alignment is active
- Auto-selection uses list position, not request index, to handle aligned pairs with empty placeholders

### Backend Architecture (Rust/Tauri)

**Core Files:**
- `src-tauri/src/main.rs` - Entry point (minimal, delegates to lib)
- `src-tauri/src/lib.rs` - Tauri app setup and command registration
- `src-tauri/src/har.rs` - HAR parsing and comparison logic

**Tauri Commands (invoked from frontend via `invoke`):**
- `open_har_file` - Opens file dialog and parses HAR file
- `align_har_requests` - Standard request alignment algorithm
- `align_har_requests_vscode` - One-to-one alignment (VSCode-style)
- `get_detailed_comparison` - Creates detailed diff between two requests
- `store_comparison_data` / `get_comparison_data` - In-memory storage for comparison data

**Comparison Algorithms:**
- **Standard Alignment** (`align_requests`): Groups requests by URL path, matches method and path (GET requests ignore query params)
- **One-to-One Alignment** (`align_requests_like_vscode`): Strict 1:1 pairing, inserts empty placeholders where requests don't match
- **Comparison Modes**:
  - `keys_only: false` - Compare full content (headers, params, body)
  - `keys_only: true` - Compare only keys (useful for structure comparison)

**Request Matching Logic:**
- GET requests: Match by path only (query parameters ignored for alignment)
- Other methods: Match by full path including query parameters
- Comparison results: "match", "partial", or "different"

### Multi-Page Setup

The app uses Vite's multi-page setup with two entry points:
- `index.html` → `src/main.tsx` → `src/App.tsx` (main comparison UI)
- `public/comparison.html` → `src/comparison-main.tsx` → `src/Comparison.tsx` (detailed comparison, currently unused)

## Data Structures

### HarRequest (shared between Rust and TypeScript)
```typescript
{
  method: string          // HTTP method (GET, POST, etc.)
  url: string            // Full URL
  path: string           // Path with query string
  headers: Record<string, string>
  query_params: Record<string, string[]>
  post_data?: string     // Request body
  response_status: number
  response_headers: Record<string, string>
  response_body?: string
  index: number          // 1-based index for display
}
```

### AlignedPair
```typescript
{
  index1?: number        // Index in first file's requests array
  index2?: number        // Index in second file's requests array
  comparison?: ComparisonResult
}
```
When a pair has only `index1` or only `index2`, it represents an unmatched request with an empty placeholder.

## Important Implementation Notes

1. **Request Indexing**:
   - Displayed indices are 1-based (user-friendly)
   - Internal array indices are 0-based
   - When alignment is active, `htmlListIndex` (position in aligned pairs) differs from `request.index`

2. **Alignment Behavior**:
   - Standard mode: Multiple requests can match same request in other file
   - One-to-one mode: Strict pairing with empty placeholders for unmatched requests

3. **Auto-Selection Logic**:
   - Uses HTML list position (visual position in DOM), not request index
   - Handles empty placeholders (null requests) in aligned view
   - Updates both selected request and index input field

4. **TypeScript Configuration**:
   - Strict mode enabled
   - Module resolution: bundler mode (Vite)
   - Unused locals/parameters checking enabled

5. **Build Output**:
   - Frontend builds to `dist/`
   - Rust builds to `src-tauri/target/release/`
   - Installers in `src-tauri/target/release/bundle/`

## Styling

- Custom CSS with dark theme
- Color coding:
  - Green (match): Requests are identical
  - Yellow (partial): Requests have non-whitelisted differences
  - Purple (whitelisted): Requests differ only in whitelisted fields
  - Red (different): Completely different paths or unmatched requests
- Professional diff viewer with GitHub-style dark theme
- Monospace fonts for code/data display

## Whitelist Configuration

The app supports whitelisting specific headers and payload keys to mark their differences with a special "whitelisted" status (displayed in purple). This is useful for ignoring expected differences like timestamps, request IDs, or session tokens.

### Config Structure

The whitelist config is a JSON file with the following structure:

```json
{
  "global": {
    "headers": ["x-request-id", "timestamp"],
    "payload_keys": ["request_id", "timestamp"]
  },
  "local": [
    {
      "host": "api.example.com",
      "headers": ["x-api-key"],
      "payload_keys": ["api_version"]
    },
    {
      "url": "https://example.com/api/v1/users",
      "headers": ["x-user-token"],
      "payload_keys": ["user_id"]
    }
  ]
}
```

- **global**: Rules that apply to all requests
  - `headers`: List of header names to whitelist (case-insensitive)
  - `payload_keys`: List of JSON keys in request/response payloads to whitelist
- **local**: Array of URL/host-specific rules (takes precedence over global)
  - `host`: Matches if the request URL contains this host string
  - `url`: Matches if the request URL contains this URL string
  - `headers` and `payload_keys`: Same as global

### How It Works

1. When comparing requests, if differences are found only in whitelisted fields, the status is "whitelisted" instead of "partial"
2. For JSON payloads, the comparison recursively checks nested keys
3. Local rules are checked first, then global rules
4. The whitelist config is stored in global Rust state and persists until cleared or reloaded

### UI Controls

- **Load Whitelist** button: Opens file dialog to select a JSON config file
- **Clear Whitelist** button: Removes the loaded config and re-compares if files are loaded
- Loading/clearing automatically triggers re-comparison if HAR files are already loaded

## Common Patterns

### Adding a New Tauri Command

1. Add function in `src-tauri/src/lib.rs` or `src-tauri/src/har.rs`
2. Register in `invoke_handler!` macro in `src-tauri/src/lib.rs`
3. Call from frontend: `await invoke<ReturnType>("command_name", { param: value })`

### State Updates with Side Effects

When updating state that affects other state (e.g., selecting a request updates index input):
```typescript
const handleSelectRequest = (request: HarRequest | null) => {
  setSelectedRequest(request);
  if (request) {
    setIndexInput(request.index.toString());
  }
};
```

## Error Handling

- HAR parsing continues on individual entry errors (logged as warnings)
- File operations wrapped in try-catch with user-friendly error messages
- Malformed HAR entries are skipped, not fatal
