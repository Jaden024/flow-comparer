# 🚀 Flow Comparer - Development Commands

A powerful HAR file comparison tool built with Tauri, React, and TypeScript.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Building](#building)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 20.19+ or 22.12+)
- **npm** or **yarn**
- **Rust** (latest stable version)
- **Tauri CLI** (will be installed with dependencies)

## 📦 Installation

Install all dependencies from the root directory:

```bash
npm install
```

This will install both frontend (React/TypeScript) and backend (Rust/Tauri) dependencies.

## 🛠️ Development

### Start Development Server

Run the application in development mode with hot reload:

```bash
npm run tauri dev
```

This command will:
- Start the Vite development server for the frontend
- Compile and run the Tauri backend
- Open the application window
- Enable hot reload for both frontend and backend changes

### Development Features

- **Hot Reload**: Changes to React components are reflected instantly
- **Rust Compilation**: Backend changes trigger automatic recompilation
- **DevTools**: Access browser developer tools for debugging
- **Console Logging**: View logs from both frontend and backend

## 🏗️ Building

### Development Build

Create a development build for testing:

```bash
npm run tauri build
```

### Production Build

Create an optimized production build:

```bash
npm run tauri build --release
```

### Build Outputs

The build process generates:
- **Windows**: `.exe` installer and portable executable
- **Executable Location**: `src-tauri/target/release/`
- **Installer Location**: `src-tauri/target/release/bundle/`

## 📁 Project Structure

```
Flow Comparer/
├── src/                    # Frontend React/TypeScript code
│   ├── App.tsx            # Main application component
│   ├── App.css            # Application styles
│   └── main.tsx           # Application entry point
├── src-tauri/             # Backend Rust/Tauri code
│   ├── src/
│   │   ├── main.rs        # Tauri application entry
│   │   ├── lib.rs         # Library exports
│   │   └── har.rs         # HAR file processing logic
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── public/                # Static assets
├── package.json           # Node.js dependencies and scripts
└── COMMANDS.md           # This file
```

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start Vite development server only |
| `npm run build` | Build frontend for production |
| `npm run tauri dev` | Start full development environment |
| `npm run tauri build` | Build complete application |
| `npm run tauri build --release` | Build optimized production version |

## 🎯 Features

- **HAR File Comparison**: Compare HTTP Archive files side by side
- **Request Alignment**: Intelligent request matching and alignment
- **Synchronized Scrolling**: Navigate both files simultaneously
- **Auto-Selection**: Automatic corresponding request selection
- **Detailed Comparison**: In-depth analysis of headers, payloads, and responses
- **Dark Theme**: Beautiful dark UI optimized for developer workflows

## 🐛 Troubleshooting

### Common Issues

1. **Node.js Version Error**
   ```
   You are using Node.js X.X.X. Vite requires Node.js version 20.19+ or 22.12+
   ```
   **Solution**: Upgrade Node.js to a supported version

2. **Rust Compilation Errors**
   **Solution**: Ensure Rust is installed and up to date:
   ```bash
   rustup update
   ```

3. **Port Already in Use**
   **Solution**: Kill the process using the port or specify a different port:
   ```bash
   npm run tauri dev -- --port 3001
   ```

## 📝 Notes

- The application uses Vite for fast frontend development
- Tauri provides native desktop capabilities with minimal overhead
- All HAR processing is done in Rust for optimal performance
- The UI is built with React and modern CSS for a responsive experience

---

**Happy Coding!** 🎉
