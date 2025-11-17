# REFRAG - Advanced RAG System

**REFRAG** (Retrieval-Enhanced Forward-looking Active Generation) is a state-of-the-art Retrieval-Augmented Generation system with advanced features including:

- ✨ **Iterative Retrieval**: Multiple retrieval passes during generation
- 🔍 **Query Decomposition**: Break complex queries into manageable sub-questions
- 🎯 **Contextual Refinement**: Use conversation context to improve retrieval
- 📊 **Relevance Re-ranking**: Re-rank results based on query relevance
- 🔐 **Advanced Permissions**: User-based, role-based, and access-level permissions
- 📝 **Rich Metadata**: Track content types, tags, versions, authors, and more
- 🚀 **Local-First**: Run everything locally with ChromaDB and Ollama

## Architecture

```
REFRAG/
├── backend/           # FastAPI backend with ChromaDB and REFRAG logic
│   ├── app/
│   │   ├── api/      # API routes
│   │   ├── core/     # Configuration
│   │   ├── models/   # Data models
│   │   └── services/ # Business logic
│   └── requirements.txt
├── frontend/         # Next.js frontend with TypeScript
│   ├── src/
│   │   ├── app/     # Next.js 14 app directory
│   │   ├── components/
│   │   └── lib/     # API client
│   └── package.json
├── config/          # Configuration files
└── docs/            # Additional documentation
```

## Features

### Document Management
- **Multiple Content Types**: Organize documents by type (policies, FAQs, manuals, etc.)
- **Rich Metadata**: Author, version, tags, timestamps, custom fields
- **Automatic Chunking**: Large documents automatically split into optimal chunks
- **Batch Operations**: Add multiple documents efficiently

### Advanced Permissions
Three-layer permission system:
1. **User-based**: Specific user IDs with access
2. **Role-based**: Admin, Editor, Viewer, Guest roles
3. **Access Levels**: Public, Internal, Confidential, Restricted

### REFRAG Query System
- **Iterative Retrieval**: Multiple retrieval iterations for complex queries
- **Query Decomposition**: Automatically break down complex questions
- **Re-ranking**: Relevance-based re-ranking of retrieved documents
- **Configurable**: Enable/disable REFRAG features per query

### Modern UI
- **Next.js 14**: Modern React framework with TypeScript
- **Tailwind CSS**: Beautiful, responsive design with dark mode
- **Real-time Feedback**: Loading states, error handling, success messages
- **Filter & Search**: Filter by content type, tags, and more

## Prerequisites

### Required
- **Python 3.9+**: For the backend
- **Node.js 18+**: For the frontend
- **Ollama**: For local LLM inference

### Optional
- **CUDA**: For GPU acceleration (faster embeddings)
- **Docker**: For containerized deployment

## Installation

### 1. Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Or download from https://ollama.com
```

Pull a model:
```bash
ollama pull llama3.1:8b
# or
ollama pull mistral
# or
ollama pull phi3
```

### 2. Backend Setup

```bash
cd REFRAG/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp ../.env.example .env
# Edit .env with your settings

# Run the backend
python -m app.main
```

The backend will be available at `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd REFRAG/frontend

# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local

# Run the frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

### Adding Documents

1. Navigate to **Add Document** page
2. Fill in the required fields:
   - **Title**: Document name
   - **Content**: The actual document text
   - **Content Type**: Category (policy, faq, manual, etc.)
   - **Source**: File path or URL
3. Add optional metadata (author, tags, version)
4. Set permissions (access level, roles, specific users)
5. Click **Add Document**

### Querying Documents

1. Navigate to the **Query** page (home)
2. Enter your question
3. Optionally filter by:
   - Content types
   - Tags
   - Number of results (top K)
4. Toggle **REFRAG** on/off
5. Click **Query** or press `Ctrl+Enter`

The system will:
- Decompose your query (if complex)
- Retrieve relevant documents iteratively
- Re-rank results for relevance
- Generate a comprehensive answer

### Viewing Documents

1. Navigate to **View Documents**
2. See all documents with metadata
3. Filter by content type or tags
4. View statistics and distribution
5. Delete documents as needed

## Configuration

### Backend Configuration

Edit `backend/.env`:

```bash
# Change the LLM model
OLLAMA_MODEL=mistral

# Adjust REFRAG behavior
MAX_RETRIEVAL_ITERATIONS=5
ENABLE_QUERY_DECOMPOSITION=True
ENABLE_RERANKING=True

# Change embedding model
EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2

# Use GPU
EMBEDDING_DEVICE=cuda
```

### Frontend Configuration

Edit `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## API Documentation

Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Key Endpoints

#### Document Management
- `POST /api/v1/documents` - Create a document
- `GET /api/v1/documents` - List documents
- `GET /api/v1/documents/{id}` - Get document by ID
- `PUT /api/v1/documents/{id}` - Update document
- `DELETE /api/v1/documents/{id}` - Delete document

#### Querying
- `POST /api/v1/query` - Query documents with REFRAG

#### System
- `GET /api/v1/health` - Health check
- `GET /api/v1/stats` - System statistics
- `GET /api/v1/content-types` - List content types
- `GET /api/v1/tags` - List all tags

## REFRAG Methodology

REFRAG enhances traditional RAG with:

1. **Query Decomposition**
   - Complex queries broken into sub-questions
   - Each sub-question processed independently
   - Results combined for comprehensive answers

2. **Iterative Retrieval**
   - Multiple retrieval passes
   - Refine context based on initial results
   - Adaptive retrieval based on query complexity

3. **Re-ranking**
   - Initial retrieval based on embedding similarity
   - Re-rank using query-specific relevance
   - Ensure most relevant documents used for generation

4. **Permission-Aware Retrieval**
   - Filter results based on user permissions
   - Respect access levels and roles
   - Secure document access

## Metadata Schema

Each document includes:

```typescript
{
  id: string;
  content_type: string;        // "policy", "faq", etc.
  title: string;
  source: string;              // file path or URL
  author: string;
  created_at: timestamp;
  updated_at: timestamp;
  version: string;             // e.g., "1.0.0"
  tags: string[];              // ["hr", "compliance"]
  permissions: {
    users: string[];           // ["user123"]
    roles: string[];           // ["admin", "viewer"]
    access_level: string;      // "public", "internal", etc.
  };
  language: string;            // "en"
  file_type: string;           // "pdf", "txt", etc.
  size: number;                // bytes
  chunk_index: number;         // for chunked docs
  parent_document_id: string;  // if chunked
  custom_metadata: object;     // additional fields
}
```

## Performance Tips

1. **Use GPU for Embeddings**
   - Set `EMBEDDING_DEVICE=cuda` in `.env`
   - Significantly faster embedding generation

2. **Adjust Chunk Size**
   - Smaller chunks (256-512): Better precision, more chunks
   - Larger chunks (1024-2048): Better context, fewer chunks

3. **Tune REFRAG Parameters**
   - `MAX_RETRIEVAL_ITERATIONS`: More = slower but thorough
   - `TOP_K_DOCUMENTS`: Higher = more context, slower
   - `SIMILARITY_THRESHOLD`: Higher = more selective

4. **Choose the Right Model**
   - Smaller models (7B): Faster, less accurate
   - Larger models (13B+): Slower, more accurate

## Troubleshooting

### Ollama Connection Failed
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Backend Won't Start
```bash
# Check Python version
python --version  # Should be 3.9+

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Frontend Build Errors
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

### No Documents Retrieved
- Check similarity threshold (try lowering it)
- Verify documents were added successfully
- Check permission settings

## Development

### Running Tests
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Code Style
```bash
# Backend
black app/
flake8 app/

# Frontend
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Report a bug]
- Documentation: See `/docs` folder
- Examples: See `/examples` folder

## Acknowledgments

- **ChromaDB**: Vector database
- **Sentence Transformers**: Embedding models
- **Ollama**: Local LLM inference
- **FastAPI**: Backend framework
- **Next.js**: Frontend framework
- **Meta REFRAG**: Inspiration for retrieval methodology

---

Built with ❤️ for better RAG systems
