# REFRAG Configuration Guide

This guide explains all configuration options available in REFRAG.

## Environment Variables

### Application Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | REFRAG RAG System | Application name |
| `APP_VERSION` | 1.0.0 | Application version |
| `DEBUG` | True | Enable debug mode |
| `API_PREFIX` | /api/v1 | API route prefix |

### Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8000 | Server port |
| `ALLOWED_ORIGINS` | localhost:3000,localhost:8000 | CORS allowed origins (comma-separated) |

### ChromaDB Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CHROMA_PERSIST_DIRECTORY` | ./chroma_db | Directory for ChromaDB data |
| `CHROMA_COLLECTION_NAME` | refrag_documents | Collection name in ChromaDB |

### Embedding Model Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | sentence-transformers/all-MiniLM-L6-v2 | Embedding model name |
| `EMBEDDING_DEVICE` | cpu | Device for embeddings (cpu or cuda) |

**Available Embedding Models:**
- `sentence-transformers/all-MiniLM-L6-v2` - Fast, good quality (384 dim)
- `sentence-transformers/all-mpnet-base-v2` - Better quality, slower (768 dim)
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` - Multilingual support

### LLM Settings (Ollama)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama API URL |
| `OLLAMA_MODEL` | llama3.1:8b | Default model to use |
| `OLLAMA_TIMEOUT` | 120 | Request timeout in seconds |

**Available Models (via Ollama):**
- `llama3.1:8b` - Recommended for balanced performance
- `llama3.1:70b` - Best quality, requires more RAM
- `mistral` - Fast, good quality
- `phi3` - Lightweight, fast
- `qwen2.5:7b` - Good for coding tasks

### REFRAG Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_RETRIEVAL_ITERATIONS` | 3 | Maximum number of retrieval iterations |
| `TOP_K_DOCUMENTS` | 5 | Number of documents to retrieve |
| `SIMILARITY_THRESHOLD` | 0.7 | Minimum similarity score (0-1) |
| `ENABLE_QUERY_DECOMPOSITION` | True | Enable query decomposition |
| `ENABLE_RERANKING` | True | Enable document re-ranking |

**Tuning Guide:**
- **More thorough retrieval**: Increase `MAX_RETRIEVAL_ITERATIONS` to 5-7
- **Faster responses**: Decrease to 1-2
- **More context**: Increase `TOP_K_DOCUMENTS` to 10-20
- **More selective**: Increase `SIMILARITY_THRESHOLD` to 0.8-0.9
- **More inclusive**: Decrease to 0.5-0.6

### Chunking Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CHUNK_SIZE` | 512 | Size of each text chunk (characters) |
| `CHUNK_OVERLAP` | 50 | Overlap between chunks (characters) |

**Tuning Guide:**
- **Small chunks (256-512)**: Better precision, more granular retrieval
- **Medium chunks (512-1024)**: Balanced approach (recommended)
- **Large chunks (1024-2048)**: More context, fewer chunks
- **Overlap**: 10-20% of chunk size recommended

### File Upload Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_UPLOAD_SIZE` | 10485760 | Max file size in bytes (10MB) |
| `ALLOWED_EXTENSIONS` | txt,pdf,docx,md,json | Allowed file extensions |
| `UPLOAD_DIRECTORY` | ./uploads | Directory for uploaded files |

## Configuration Presets

### Development (Fast Iteration)

```bash
DEBUG=True
EMBEDDING_DEVICE=cpu
OLLAMA_MODEL=phi3
MAX_RETRIEVAL_ITERATIONS=2
TOP_K_DOCUMENTS=3
ENABLE_QUERY_DECOMPOSITION=False
ENABLE_RERANKING=False
CHUNK_SIZE=256
```

### Production (Balanced)

```bash
DEBUG=False
EMBEDDING_DEVICE=cuda
OLLAMA_MODEL=llama3.1:8b
MAX_RETRIEVAL_ITERATIONS=3
TOP_K_DOCUMENTS=5
ENABLE_QUERY_DECOMPOSITION=True
ENABLE_RERANKING=True
CHUNK_SIZE=512
```

### High Quality (Thorough)

```bash
DEBUG=False
EMBEDDING_DEVICE=cuda
EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2
OLLAMA_MODEL=llama3.1:70b
MAX_RETRIEVAL_ITERATIONS=5
TOP_K_DOCUMENTS=10
SIMILARITY_THRESHOLD=0.6
ENABLE_QUERY_DECOMPOSITION=True
ENABLE_RERANKING=True
CHUNK_SIZE=1024
```

### Performance Optimized (Speed)

```bash
DEBUG=False
EMBEDDING_DEVICE=cuda
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
OLLAMA_MODEL=phi3
MAX_RETRIEVAL_ITERATIONS=1
TOP_K_DOCUMENTS=3
SIMILARITY_THRESHOLD=0.75
ENABLE_QUERY_DECOMPOSITION=False
ENABLE_RERANKING=False
CHUNK_SIZE=256
```

## Model Selection Guide

### Embedding Models

| Model | Dimensions | Speed | Quality | Use Case |
|-------|------------|-------|---------|----------|
| all-MiniLM-L6-v2 | 384 | Fast | Good | General purpose |
| all-mpnet-base-v2 | 768 | Medium | Better | High quality retrieval |
| paraphrase-multilingual | 384 | Fast | Good | Multilingual content |

### LLM Models (Ollama)

| Model | Size | RAM Required | Speed | Quality | Use Case |
|-------|------|--------------|-------|---------|----------|
| phi3 | 3.8GB | 8GB | Very Fast | Good | Quick responses |
| mistral | 4.1GB | 8GB | Fast | Good | Balanced |
| llama3.1:8b | 4.7GB | 8GB | Medium | Better | Recommended |
| llama3.1:70b | 40GB | 64GB | Slow | Best | High quality |

## Hardware Recommendations

### Minimum

- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 10GB
- **GPU**: None required

**Expected Performance**: 5-10 seconds per query

### Recommended

- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 50GB
- **GPU**: NVIDIA GPU with 6GB+ VRAM

**Expected Performance**: 2-5 seconds per query

### High Performance

- **CPU**: 16+ cores
- **RAM**: 32GB+
- **Storage**: 100GB+ SSD
- **GPU**: NVIDIA GPU with 12GB+ VRAM

**Expected Performance**: <2 seconds per query

## Optimization Tips

### For Speed

1. Use smaller models: `phi3` or `mistral`
2. Reduce retrieval iterations: `MAX_RETRIEVAL_ITERATIONS=1`
3. Lower top K: `TOP_K_DOCUMENTS=3`
4. Disable query decomposition
5. Use GPU for embeddings: `EMBEDDING_DEVICE=cuda`
6. Smaller chunks: `CHUNK_SIZE=256`

### For Quality

1. Use larger models: `llama3.1:70b`
2. Better embeddings: `all-mpnet-base-v2`
3. Increase iterations: `MAX_RETRIEVAL_ITERATIONS=5`
4. Higher top K: `TOP_K_DOCUMENTS=10`
5. Enable all features
6. Larger chunks: `CHUNK_SIZE=1024`

### For Memory Efficiency

1. Use smaller embedding model
2. Reduce chunk overlap: `CHUNK_OVERLAP=25`
3. Lower top K
4. Use CPU instead of GPU if RAM limited

### For Multilingual Support

1. Use multilingual embedding model
2. Set appropriate language in metadata
3. Consider using multilingual LLM

## Troubleshooting Configuration

### Issue: Out of Memory

**Solutions:**
- Reduce `TOP_K_DOCUMENTS`
- Use smaller model
- Reduce `CHUNK_SIZE`
- Use CPU instead of CUDA

### Issue: Slow Responses

**Solutions:**
- Enable GPU: `EMBEDDING_DEVICE=cuda`
- Use smaller model: `OLLAMA_MODEL=phi3`
- Reduce iterations: `MAX_RETRIEVAL_ITERATIONS=1`
- Disable features temporarily

### Issue: Poor Retrieval Quality

**Solutions:**
- Lower `SIMILARITY_THRESHOLD`
- Increase `TOP_K_DOCUMENTS`
- Enable query decomposition
- Use better embedding model
- Adjust chunk size

### Issue: No Results Found

**Solutions:**
- Lower `SIMILARITY_THRESHOLD` to 0.5
- Increase `TOP_K_DOCUMENTS`
- Check document permissions
- Verify embeddings are generated

## Security Considerations

### Production Deployment

```bash
# Disable debug mode
DEBUG=False

# Restrict CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Set appropriate file limits
MAX_UPLOAD_SIZE=5242880  # 5MB

# Use environment-specific secrets
# Don't commit .env files
```

### Permission Best Practices

1. Default to `internal` access level
2. Use roles for department-wide access
3. Use user IDs for individual access
4. Regular audit of document permissions

## Monitoring

### Metrics to Track

- Query response time
- Documents retrieved per query
- Retrieval iterations used
- Cache hit rate
- Error rates

### Health Checks

```bash
# Check backend
curl http://localhost:8000/api/v1/health

# Check stats
curl http://localhost:8000/api/v1/stats
```

## Migration Guide

### Upgrading ChromaDB

1. Backup `chroma_db` directory
2. Update ChromaDB version in requirements.txt
3. Run migrations if needed
4. Verify collection integrity

### Changing Embedding Models

⚠️ **Warning**: Changing embedding models requires re-indexing all documents

1. Backup current data
2. Update `EMBEDDING_MODEL`
3. Reset collection or re-embed all documents
4. Verify retrieval quality

### Scaling Up

For production scale:
1. Use separate ChromaDB server
2. Add Redis for caching
3. Load balance multiple backend instances
4. Use CDN for frontend
5. Monitor resource usage

## Support

For configuration help:
- Check logs: Backend logs show config on startup
- Validate .env: Ensure no syntax errors
- Test incrementally: Change one setting at a time
- Consult README.md for examples
