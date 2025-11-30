# 🧩 Visual YAML Builder

A powerful, intuitive drag-and-drop GUI for creating and visualizing YAML files. Say goodbye to indentation errors and hello to visual YAML editing!

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![License](https://img.shields.io/badge/license-ISC-green)

## ✨ Features

### 🎨 Visual Editor
- **Drag-and-drop interface** for creating YAML structures
- **Block-based editing** with three block types:
  - Key-Value pairs
  - Objects (nested structures)
  - Arrays (lists)
- **Real-time YAML preview** with syntax highlighting
- **Nested structure support** with visual indentation

### 🔍 Visualization Modes
- **Editor Mode**: Interactive block-based editor
- **Tree View**: Hierarchical tree visualization
- **Workflow View**: Node-based diagram (similar to n8n/Node-RED)

### ✅ Validation
- **Real-time syntax validation**
- **Duplicate key detection**
- **Invalid key warnings**
- **Error highlighting** in both GUI and preview

### 💾 Storage & Export
- **Browser storage** (LocalStorage) for saving/loading YAML files
- **Export to .yaml** files
- **Import existing YAML** files
- **Auto-save support** with named saves

### 🎯 User Experience
- Clean, modern interface with dark mode support
- Split-screen layout (editor + preview)
- Error indicators in header
- Copy-to-clipboard functionality
- Responsive design

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd YAMLBuilder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## 📖 Usage Guide

### Creating YAML

1. **Add Blocks**: Click the block type buttons (+ Key-Value, + Object, + Array)
2. **Edit Blocks**: Enter key names and values in the input fields
3. **Nest Structures**: Use the + button on Object/Array blocks to add children
4. **Delete Blocks**: Click the trash icon to remove blocks

### Saving & Loading

1. **Save**: Click "Save" button, enter a name, and save to browser storage
2. **Load**: Click "Load" button, select from saved YAMLs
3. **Export**: Click "Export" to download as .yaml file
4. **Import**: Click "Import" to load an existing .yaml file

### Visualization

1. **Editor Mode**: Default drag-and-drop editing interface
2. **Tree View**: Hierarchical visualization of YAML structure
3. **Workflow View**: Interactive node-based diagram

### Validation

- Errors appear in red in the header and preview pane
- Warnings appear in yellow
- Hover over error indicators for details
- Common validations:
  - Duplicate keys
  - Empty keys
  - Keys starting with numbers

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **YAML Parser**: js-yaml
- **Drag & Drop**: react-dnd
- **Workflow Visualization**: @xyflow/react
- **Icons**: lucide-react

### Project Structure
```
YAMLBuilder/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main page
├── components/
│   ├── YAMLBuilder.tsx      # Main builder component
│   ├── Header.tsx           # Header with view mode selector
│   ├── BlockEditor.tsx      # Block editor container
│   ├── YAMLBlock.tsx        # Individual block component
│   ├── YAMLPreview.tsx      # YAML preview pane
│   ├── TreeView.tsx         # Tree visualization
│   ├── WorkflowView.tsx     # Workflow diagram
│   └── SaveLoadModal.tsx    # Save/Load modal
├── lib/
│   ├── types.ts             # TypeScript types
│   ├── yamlUtils.ts         # YAML conversion utilities
│   └── storage.ts           # Browser storage utilities
└── utils/
```

## 🎯 Roadmap

### ✅ MVP (Current Version)
- [x] GUI editor with drag-and-drop
- [x] Tree and Workflow visualizations
- [x] Real-time validation
- [x] Browser storage
- [x] Import/Export functionality

### 🔮 Future Phases

#### Phase 2: Schema-Aware Editing
- [ ] Kubernetes CRD support
- [ ] CI/CD pipeline templates (GitHub Actions, GitLab CI)
- [ ] Docker Compose support
- [ ] Custom schema definitions

#### Phase 3: Git Integration
- [ ] GitHub/GitLab integration
- [ ] Version control
- [ ] Diff visualization
- [ ] Audit trails

#### Phase 4: Collaboration
- [ ] Multi-user editing
- [ ] Real-time collaboration
- [ ] Comments and annotations
- [ ] Plugin marketplace

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📝 License

ISC License

## 👤 Author

**Ouzayr Khedun**

## 🙏 Acknowledgments

- Inspired by workflow tools like n8n and Node-RED
- Built with the amazing Next.js framework
- Icons by Lucide

## 📚 Documentation

### Block Types

#### Key-Value
Simple key-value pairs for primitive values (strings, numbers, booleans).

```yaml
key: value
port: 8080
enabled: true
```

#### Object
Nested structures containing other blocks.

```yaml
database:
  host: localhost
  port: 5432
```

#### Array
Lists of items (can contain primitives or objects).

```yaml
servers:
  - name: web-1
    ip: 192.168.1.1
  - name: web-2
    ip: 192.168.1.2
```

### Keyboard Shortcuts

- `Enter`: Submit save name in save modal
- `Esc`: Close modals (future feature)

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Storage Limits

- LocalStorage: ~5MB typical limit
- Recommendation: Export large YAMLs to files

## 🐛 Known Issues

- None at this time

## 💡 Tips & Tricks

1. **Start Simple**: Begin with key-value pairs, then add complexity
2. **Use Tree View**: Great for understanding nested structures
3. **Save Often**: Use browser storage to avoid losing work
4. **Export Important Work**: Download critical YAMLs to files
5. **Workflow View**: Best for visualizing complex relationships

---

**Happy YAML Building! 🎉**
