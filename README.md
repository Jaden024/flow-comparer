# Flow Comparer 🔍

A powerful desktop application for comparing HTTP Archive (HAR) files to analyze and debug web application network flows. Built with Tauri, React, and TypeScript for optimal performance and cross-platform compatibility.

## 🎯 What is Flow Comparer?

Flow Comparer is a specialized tool designed for web developers, QA engineers, and DevOps professionals who need to analyze and compare network traffic between different environments, versions, or test scenarios. It provides an intuitive interface to examine HTTP requests, responses, and identify differences in web application behavior.

## 🚀 Key Features

### 📊 **Comprehensive HAR File Analysis**
- **Load and parse** HAR files from browser developer tools or automated testing
- **Visual request listing** with method, URL, status code, and timing information
- **Request indexing** starting from 1 for user-friendly navigation
- **Jump to specific requests** by index with intelligent scrolling

### 🔄 **Advanced Comparison Engine**
- **Side-by-side comparison** of two HAR files
- **Smart request matching** based on URL patterns (excludes GET parameters for better matching)
- **Aligned view** showing corresponding requests between files
- **Color-coded comparison results**:
  - **Green**: Requests match completely
  - **Yellow**: Requests have differences
  - **Purple**: Requests differ only in whitelisted fields
  - **Red**: Different paths or unmatched requests
- **Automatic synchronization** of selection between comparison panels

### 🔍 **Detailed Request Analysis**
- **Multi-tab detailed view** with:
  - General information (method, URL, status, timing)
  - Request headers
  - Request payloads
  - Request parameters
  - Response headers
  - Response body content
- **Custom diff visualization** with intelligent highlighting:
  - **Green**: Added content
  - **Red**: Removed content
  - **Purple**: Whitelisted differences (expected changes)
  - **Black**: Identical content
- **Synchronized scrolling** between comparison panes
- **Word wrap** for long lines with unlimited vertical expansion
- **Copy functionality** with visual feedback for any content section

### 🎨 **Whitelist Configuration**
- **Smart difference filtering** to ignore expected changes
- **Global and local rules** for flexible configuration
- **Header whitelisting** for dynamic headers (timestamps, request IDs, tokens)
- **Payload key whitelisting** for JSON fields that are expected to differ
- **Visual distinction** with purple highlighting for whitelisted differences
- **Example configuration** included in `whitelist-config.example.json`

### 🎨 **User Experience**
- **Dark, professional theme** optimized for long analysis sessions
- **Responsive design** that works on various screen sizes
- **Intuitive navigation** with keyboard shortcuts and mouse interactions
- **Zoom controls** (Ctrl +/-, Ctrl 0 to reset)
- **Visual feedback** for all user actions (copying, selection, etc.)

## 🛠️ How It Works

### 1. **HAR File Generation**
First, generate HAR files from your web applications:
- **Chrome/Edge**: Open DevTools → Network tab → Right-click → "Save all as HAR"
- **Firefox**: Open DevTools → Network tab → Settings gear → "Save All As HAR"
- **Automated tools**: Use Selenium, Playwright, or similar tools to capture network traffic

### 2. **Loading Files**
- Click **"Select Original HAR File"** to load your baseline/reference file
- Click **"Select Comparison HAR File"** to load the file you want to compare against
- Files are parsed and displayed with request counts and basic statistics

### 3. **Comparison Analysis**
- **Individual Analysis**: Browse requests in each file independently
- **Aligned Comparison**: Click "Show Aligned Requests" to see matched requests side-by-side
- **Request Navigation**: Use index input fields to jump to specific requests
- **Detailed Inspection**: Click any request to open the detailed comparison modal

### 4. **Detailed Comparison**
- **Tab-based interface** for different aspects of the request/response
- **Custom diff view** with intelligent color-coding:
  - Green for additions
  - Red for removals
  - Purple for whitelisted differences
- **Copy functionality** for sharing specific content or debugging
- **Visual indicators** for successful copy operations

### 5. **Whitelist Configuration (Optional)**

Create a whitelist configuration file to mark expected differences with purple color instead of red/green:

#### **Creating a Whitelist Config**

Create a JSON file with the following structure (see `whitelist-config.example.json`):

```json
{
  "global": {
    "headers": [
      "x-request-id",
      "x-correlation-id",
      "date",
      "timestamp"
    ],
    "payload_keys": [
      "timestamp",
      "request_id",
      "session_id"
    ]
  },
  "local": [
    {
      "host": "api.example.com",
      "headers": ["x-api-key", "authorization"],
      "payload_keys": ["api_version", "client_id"]
    },
    {
      "url": "https://example.com/api/v1/users",
      "headers": ["x-user-token"],
      "payload_keys": ["user_id", "last_login"]
    }
  ]
}
```

#### **Using the Whitelist**

1. Click **"Load Whitelist"** button in the toolbar
2. Select your JSON configuration file
3. The app will automatically re-compare the loaded HAR files
4. Differences in whitelisted fields will now appear in **purple** instead of red/green
5. Click **"Clear Whitelist"** to remove the configuration and revert to normal comparison

#### **Configuration Options**

- **`global`**: Rules that apply to all requests
  - `headers`: List of header names (case-insensitive)
  - `payload_keys`: List of JSON keys in request/response bodies
- **`local`**: Array of URL/host-specific rules (takes precedence over global)
  - `host`: Matches if request URL contains this host string
  - `url`: Matches if request URL contains this URL string
  - `headers` and `payload_keys`: Same as global

**Use Cases:**
- Ignore dynamic timestamps, request IDs, or session tokens
- Filter out authentication headers that differ between environments
- Focus on meaningful changes by hiding expected variations

## 🎯 Why Flow Comparer is Needed

### **Common Use Cases**

#### 🔧 **Development & Testing**
- **API Changes**: Compare network flows before and after API modifications
- **Environment Differences**: Analyze differences between development, staging, and production
- **Performance Analysis**: Compare request timing and payload sizes across versions
- **Regression Testing**: Ensure new features don't break existing network flows

#### 🐛 **Debugging & Troubleshooting**
- **Bug Investigation**: Compare working vs. broken scenarios to identify issues
- **Third-party Integration**: Analyze differences in external API calls
- **Authentication Flows**: Debug login, OAuth, or session management issues
- **Error Analysis**: Compare successful vs. failed request patterns

#### 📊 **Quality Assurance**
- **Cross-browser Testing**: Compare network behavior across different browsers
- **Mobile vs. Desktop**: Analyze differences in network flows between platforms
- **A/B Testing**: Compare network patterns between different feature variants
- **Load Testing**: Analyze network behavior under different load conditions

#### 🔍 **Security Analysis**
- **Request Validation**: Ensure sensitive data isn't exposed in requests
- **Header Analysis**: Compare security headers across environments
- **Cookie Tracking**: Analyze session and tracking cookie behavior
- **HTTPS Migration**: Verify proper secure request handling

### **Why Existing Tools Fall Short**

- **Browser DevTools**: Limited to single sessions, no comparison capabilities
- **Generic Diff Tools**: Don't understand HAR structure or HTTP semantics
- **Command Line Tools**: Lack visual interface for complex analysis
- **Online Tools**: Security concerns with uploading sensitive network data

Flow Comparer fills this gap by providing a **secure, offline, visual tool** specifically designed for HTTP traffic analysis and comparison.

## 🚀 Getting Started

### Quick Start (Recommended)

**Download the latest pre-built version from the [Releases](https://github.com/Jaden024/flow-comparer/releases) page** - Standalone | Installable. Only Windows version for now.

### Development Setup

If you want to build from source or contribute to the project:

#### Prerequisites
- **Node.js** (version 20.19+ or 22.12+)
- **Rust** (latest stable version)
- **npm** or **yarn** package manager

#### Installation & Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jaden024/flow-comparer
   cd flow-comparer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

4. **Build for production**
   ```bash
   npm run tauri build
   ```

## 🏗️ Technical Architecture

- **Frontend**: React 19 + TypeScript + Vite for fast development and modern UI
- **Backend**: Rust + Tauri 2 for secure, fast file processing and cross-platform compatibility
- **Styling**: Custom CSS with professional dark theme
- **Parsing**: Robust HAR file parsing with error handling for malformed entries
- **Diff Engine**: Custom line-by-line comparison algorithm with whitelist support
- **Diff Viewer**: Custom-built split-view diff component with synchronized scrolling and word wrap

## ⌨️ Keyboard Shortcuts

- **Ctrl + +** or **Ctrl + =** - Zoom in
- **Ctrl + -** - Zoom out
- **Ctrl + 0** - Reset zoom to 100%
- **Double-click** on a request - Open detailed comparison (when both requests are selected)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for the reverse engineering community**
