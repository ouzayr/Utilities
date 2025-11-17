"""
API routes for REFRAG application
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional, Dict, Any
import logging
import json

from app.models.document import (
    DocumentCreate,
    DocumentUpdate,
    QueryRequest,
    QueryResponse,
    DocumentResponse,
    PermissionModel
)
from app.services.document_service import document_service
from app.services.refrag_service import refrag_service
from app.services.chroma_service import chroma_service
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

router = APIRouter()


# Document Management Endpoints

@router.post("/documents", response_model=Dict[str, str])
async def create_document(doc: DocumentCreate):
    """Create a new document"""
    try:
        doc_id = document_service.create_document(doc)
        return {"id": doc_id, "message": "Document created successfully"}
    except Exception as e:
        logger.error(f"Error creating document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/batch", response_model=Dict[str, Any])
async def create_documents_batch(docs: List[DocumentCreate]):
    """Create multiple documents in batch"""
    try:
        doc_ids = document_service.create_documents_batch(docs)
        return {
            "ids": doc_ids,
            "count": len(doc_ids),
            "message": f"Created {len(doc_ids)} documents successfully"
        }
    except Exception as e:
        logger.error(f"Error creating documents batch: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/chunk", response_model=Dict[str, Any])
async def create_chunked_document(
    content: str = Form(...),
    metadata: str = Form(...)
):
    """Create a document with automatic chunking"""
    try:
        # Parse metadata JSON
        metadata_dict = json.loads(metadata)
        doc_create = DocumentCreate(**metadata_dict)

        # Chunk and create
        chunk_ids = document_service.chunk_and_create_document(
            content=content,
            doc_create=doc_create
        )

        return {
            "chunk_ids": chunk_ids,
            "chunk_count": len(chunk_ids),
            "message": f"Document chunked into {len(chunk_ids)} parts"
        }
    except Exception as e:
        logger.error(f"Error creating chunked document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str):
    """Get a document by ID"""
    try:
        doc = document_service.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        return DocumentResponse(
            id=doc["id"],
            content=doc["content"],
            metadata=doc["metadata"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/documents/{doc_id}", response_model=Dict[str, str])
async def update_document(doc_id: str, doc_update: DocumentUpdate):
    """Update a document"""
    try:
        success = document_service.update_document(doc_id, doc_update)
        if success:
            return {"message": "Document updated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update document")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{doc_id}", response_model=Dict[str, str])
async def delete_document(doc_id: str):
    """Delete a document"""
    try:
        success = document_service.delete_document(doc_id)
        if success:
            return {"message": "Document deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete document")
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    content_type: Optional[str] = None,
    tags: Optional[str] = None,
    limit: int = 100
):
    """List documents with optional filters"""
    try:
        tags_list = tags.split(",") if tags else None
        docs = document_service.list_documents(
            content_type=content_type,
            tags=tags_list,
            limit=limit
        )

        return [
            DocumentResponse(
                id=doc["id"],
                content=doc["content"][:500] + "..." if len(doc["content"]) > 500 else doc["content"],
                metadata=doc["metadata"]
            )
            for doc in docs
        ]
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Query Endpoints

@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Query documents using REFRAG"""
    try:
        response = refrag_service.query(request)
        return response
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# System Endpoints

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        ollama_healthy = llm_service.check_health()
        chroma_stats = chroma_service.get_collection_stats()

        return {
            "status": "healthy",
            "ollama": "connected" if ollama_healthy else "disconnected",
            "chroma": {
                "status": "connected",
                "documents": chroma_stats["document_count"]
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@router.get("/stats")
async def get_stats():
    """Get system statistics"""
    try:
        doc_stats = document_service.get_stats()
        ollama_models = llm_service.list_models()

        return {
            "documents": doc_stats,
            "ollama": {
                "models": ollama_models,
                "current_model": llm_service.model
            }
        }
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/content-types")
async def get_content_types():
    """Get list of content types in the system"""
    try:
        docs = document_service.list_documents(limit=1000)
        content_types = list(set(
            doc["metadata"].get("content_type", "unknown")
            for doc in docs
        ))
        return {"content_types": sorted(content_types)}
    except Exception as e:
        logger.error(f"Error getting content types: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tags")
async def get_tags():
    """Get list of tags in the system"""
    try:
        docs = document_service.list_documents(limit=1000)
        tags = set()
        for doc in docs:
            doc_tags = doc["metadata"].get("tags", "").split(",")
            tags.update(tag.strip() for tag in doc_tags if tag.strip())
        return {"tags": sorted(list(tags))}
    except Exception as e:
        logger.error(f"Error getting tags: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Utility Endpoints

@router.post("/reset")
async def reset_collection():
    """Reset the entire collection (use with caution!)"""
    try:
        chroma_service.reset_collection()
        return {"message": "Collection reset successfully"}
    except Exception as e:
        logger.error(f"Error resetting collection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
