# REFRAG Quickstart Guide

Get up and running with REFRAG in 5 minutes!

## Quick Setup

### 1. Install Ollama and Pull a Model

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (choose one)
ollama pull llama3.1:8b    # Recommended
# or
ollama pull mistral        # Alternative
# or
ollama pull phi3           # Lightweight option

# Verify it's running
ollama list
```

### 2. Start the Backend

```bash
cd REFRAG/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp ../.env.example .env

# Start the server
python -m app.main
```

Backend should now be running at `http://localhost:8000`

### 3. Start the Frontend

Open a new terminal:

```bash
cd REFRAG/frontend

# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local

# Start the dev server
npm run dev
```

Frontend should now be running at `http://localhost:3000`

## First Steps

### 1. Add Your First Document

1. Open `http://localhost:3000/add-document`
2. Fill in the form:
   ```
   Title: Company Privacy Policy
   Content Type: policy
   Source: company_policies/privacy.pdf
   Content: [Paste your policy text]
   Tags: legal, privacy, gdpr
   Access Level: internal
   ```
3. Click "Add Document"

### 2. Query Your Documents

1. Go to `http://localhost:3000`
2. Enter a question:
   ```
   What is our policy on user data retention?
   ```
3. Click "Query" or press `Ctrl+Enter`
4. View the AI-generated answer and source documents

## Example Use Cases

### Use Case 1: Company Policy Knowledge Base

Add different policy documents:
- Privacy Policy (content_type: "policy", tags: "privacy, legal")
- Security Policy (content_type: "policy", tags: "security, legal")
- HR Handbook (content_type: "manual", tags: "hr, employees")
- Code of Conduct (content_type: "policy", tags: "ethics, employees")

Query examples:
- "What are the security requirements for password management?"
- "What is the procedure for reporting ethics violations?"
- "What benefits do employees receive?"

### Use Case 2: Product Documentation

Add product docs:
- User Guide (content_type: "manual", tags: "user, guide")
- API Documentation (content_type: "manual", tags: "developer, api")
- FAQ (content_type: "faq", tags: "support, common")
- Troubleshooting (content_type: "manual", tags: "support, troubleshooting")

Query examples:
- "How do I authenticate API requests?"
- "What are the rate limits for the API?"
- "How do I reset my password?"

### Use Case 3: Research Knowledge Base

Add research papers and notes:
- Research Papers (content_type: "paper", tags: "research, science")
- Meeting Notes (content_type: "notes", tags: "meetings, internal")
- Project Plans (content_type: "plan", tags: "projects, planning")
- Literature Reviews (content_type: "review", tags: "research, literature")

Query examples:
- "What methodologies were used in the machine learning studies?"
- "What were the key decisions from the Q2 planning meeting?"
- "What are the current gaps in the literature?"

## Testing REFRAG Features

### Test Query Decomposition

Try a complex query:
```
What are our policies on data privacy and how do they relate to
employee access controls and security requirements?
```

With REFRAG enabled, the system will:
1. Decompose into sub-queries
2. Retrieve documents for each sub-query
3. Combine results for comprehensive answer

### Test Permission Filtering

Create documents with different access levels:
- Public document (access_level: "public")
- Internal document (access_level: "internal")
- Confidential document (access_level: "confidential")

Query without user_id: Only public and internal docs returned
Query with user_id in permissions: Restricted docs also returned

### Test Content Type Filtering

Add documents of various types, then filter queries:
- Filter to only "policy" documents
- Filter to only "faq" documents
- Compare results

## Configuration Tips

### For Better Performance

Edit `backend/.env`:
```bash
# Use GPU if available
EMBEDDING_DEVICE=cuda

# Increase chunk size for longer context
CHUNK_SIZE=1024

# Use a better embedding model
EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2
```

### For Different LLMs

```bash
# Try different models
OLLAMA_MODEL=mistral
# or
OLLAMA_MODEL=phi3
# or
OLLAMA_MODEL=llama3.1:70b  # If you have enough RAM
```

### For More Thorough Retrieval

```bash
# Increase retrieval iterations
MAX_RETRIEVAL_ITERATIONS=5

# Lower similarity threshold
SIMILARITY_THRESHOLD=0.5

# Increase number of documents retrieved
TOP_K_DOCUMENTS=10
```

## Verifying Everything Works

### 1. Check Backend Health

```bash
curl http://localhost:8000/api/v1/health
```

Should return:
```json
{
  "status": "healthy",
  "ollama": "connected",
  "chroma": {
    "status": "connected",
    "documents": 0
  }
}
```

### 2. Check Frontend

Open `http://localhost:3000` - you should see the query interface

### 3. Test API Directly

```bash
# Add a test document
curl -X POST http://localhost:8000/api/v1/documents \
  -H "Content-Type: application/json" \
  -d '{
    "content": "REFRAG is an advanced RAG system with iterative retrieval.",
    "title": "Test Document",
    "content_type": "test",
    "source": "manual",
    "file_type": "txt"
  }'

# Query
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is REFRAG?",
    "enable_refrag": true
  }'
```

## Common Issues

### "Ollama connection failed"
```bash
# Make sure Ollama is running
ollama serve
```

### "Module not found" errors
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### "Port already in use"
```bash
# Backend - change port in .env
PORT=8001

# Frontend - start on different port
npm run dev -- -p 3001
```

### Slow responses
- Use a smaller model: `ollama pull phi3`
- Enable GPU: `EMBEDDING_DEVICE=cuda`
- Reduce top K: `TOP_K_DOCUMENTS=3`

## Next Steps

1. **Add More Documents**: Build your knowledge base
2. **Experiment with Permissions**: Test different access levels
3. **Try Different Models**: Compare LLM performance
4. **Customize UI**: Modify frontend components
5. **Integrate with Your App**: Use the API directly

## Resources

- API Docs: `http://localhost:8000/docs`
- Full README: `../README.md`
- Configuration Guide: `../config/README.md`
- Example Scripts: `../examples/`

Happy querying! 🚀
