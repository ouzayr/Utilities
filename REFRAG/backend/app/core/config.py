"""
Configuration settings for REFRAG application
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings"""

    # App Settings
    APP_NAME: str = "REFRAG RAG System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS Settings
    ALLOWED_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # ChromaDB Settings
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "refrag_documents"

    # Embedding Model Settings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DEVICE: str = "cpu"  # or "cuda" if GPU available

    # LLM Settings (Ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"  # Default model
    OLLAMA_TIMEOUT: int = 120

    # REFRAG Settings
    MAX_RETRIEVAL_ITERATIONS: int = 3
    TOP_K_DOCUMENTS: int = 5
    SIMILARITY_THRESHOLD: float = 0.7
    ENABLE_QUERY_DECOMPOSITION: bool = True
    ENABLE_RERANKING: bool = True

    # Chunking Settings
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 50

    # File Upload Settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: list = ["txt", "pdf", "docx", "md", "json"]
    UPLOAD_DIRECTORY: str = "./uploads"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Create global settings instance
settings = Settings()


# Ensure necessary directories exist
os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
