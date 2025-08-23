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
- **Automatic synchronization** of selection between comparison panels

### 🔍 **Detailed Request Analysis**
- **Multi-tab detailed view** with:
  - General information (method, URL, status, timing)
  - Request headers
  - Request payloads
  - Request parameters
  - Response headers
  - Response body content
- **Professional diff visualization** with syntax highlighting
- **Copy functionality** with visual feedback for any content section

### 🎨 **User Experience**
- **Dark, professional theme** optimized for long analysis sessions
- **Responsive design** that works on various screen sizes
- **Intuitive navigation** with keyboard shortcuts and mouse interactions
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
- **Professional diff view** highlighting differences between files
- **Copy functionality** for sharing specific content or debugging
- **Visual indicators** for successful copy operations

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

- **Frontend**: React 18 + TypeScript + Vite for fast development and modern UI
- **Backend**: Rust + Tauri for secure, fast file processing and cross-platform compatibility
- **Styling**: Custom CSS with professional dark theme
- **Parsing**: Robust HAR file parsing with error handling for malformed entries
- **Diff Engine**: Custom comparison algorithm optimized for HTTP request matching

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for the web development community**
