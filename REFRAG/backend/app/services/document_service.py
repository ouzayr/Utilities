"""
Document processing service for file handling and chunking
"""
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import logging
import os
import hashlib

from app.core.config import settings
from app.services.chroma_service import chroma_service
from app.services.embedding_service import embedding_service
from app.models.document import (
    DocumentMetadata,
    DocumentCreate,
    DocumentUpdate,
    PermissionModel,
    AccessLevel,
    Role
)

logger = logging.getLogger(__name__)


class DocumentService:
    """Service for document processing and management"""

    def __init__(self):
        """Initialize document service"""
        self.chroma = chroma_service
        self.embeddings = embedding_service
        logger.info("Document service initialized")

    def create_document(
        self,
        doc_create: DocumentCreate
    ) -> str:
        """
        Create a new document

        Args:
            doc_create: Document creation data

        Returns:
            Document ID
        """
        # Generate document ID
        doc_id = str(uuid.uuid4())

        # Create metadata
        metadata = DocumentMetadata(
            id=doc_id,
            content_type=doc_create.content_type,
            title=doc_create.title,
            source=doc_create.source,
            author=doc_create.author,
            version=doc_create.version,
            tags=doc_create.tags,
            permissions=doc_create.permissions or PermissionModel(),
            language=doc_create.language,
            file_type=doc_create.file_type,
            size=len(doc_create.content.encode('utf-8')),
            custom_metadata=doc_create.custom_metadata
        )

        # Generate embedding
        embedding = self.embeddings.encode(doc_create.content)

        # Add to ChromaDB
        self.chroma.add_document(
            content=doc_create.content,
            metadata=metadata,
            embedding=embedding,
            doc_id=doc_id
        )

        logger.info(f"Document created: {doc_id}")
        return doc_id

    def create_documents_batch(
        self,
        docs_create: List[DocumentCreate]
    ) -> List[str]:
        """
        Create multiple documents in batch

        Args:
            docs_create: List of document creation data

        Returns:
            List of document IDs
        """
        doc_ids = []
        contents = []
        metadatas = []
        embeddings_list = []

        for doc_create in docs_create:
            # Generate document ID
            doc_id = str(uuid.uuid4())
            doc_ids.append(doc_id)

            # Create metadata
            metadata = DocumentMetadata(
                id=doc_id,
                content_type=doc_create.content_type,
                title=doc_create.title,
                source=doc_create.source,
                author=doc_create.author,
                version=doc_create.version,
                tags=doc_create.tags,
                permissions=doc_create.permissions or PermissionModel(),
                language=doc_create.language,
                file_type=doc_create.file_type,
                size=len(doc_create.content.encode('utf-8')),
                custom_metadata=doc_create.custom_metadata
            )

            contents.append(doc_create.content)
            metadatas.append(metadata)

        # Generate embeddings in batch
        embeddings_list = self.embeddings.encode(contents)

        # Add to ChromaDB
        self.chroma.add_documents_batch(
            contents=contents,
            metadatas=metadatas,
            embeddings=embeddings_list,
            doc_ids=doc_ids
        )

        logger.info(f"Batch created {len(doc_ids)} documents")
        return doc_ids

    def chunk_and_create_document(
        self,
        content: str,
        doc_create: DocumentCreate,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None
    ) -> List[str]:
        """
        Chunk a large document and create multiple entries

        Args:
            content: Full document content
            doc_create: Document creation data
            chunk_size: Size of each chunk
            chunk_overlap: Overlap between chunks

        Returns:
            List of chunk document IDs
        """
        chunk_size = chunk_size or settings.CHUNK_SIZE
        chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

        # Generate parent document ID
        parent_id = str(uuid.uuid4())

        # Split into chunks
        chunks = self._split_text(content, chunk_size, chunk_overlap)

        logger.info(f"Split document into {len(chunks)} chunks")

        # Create document for each chunk
        chunk_docs = []
        for i, chunk in enumerate(chunks):
            chunk_create = DocumentCreate(
                content=chunk,
                content_type=doc_create.content_type,
                title=f"{doc_create.title} (Chunk {i+1}/{len(chunks)})",
                source=doc_create.source,
                author=doc_create.author,
                version=doc_create.version,
                tags=doc_create.tags,
                permissions=doc_create.permissions,
                language=doc_create.language,
                file_type=doc_create.file_type,
                custom_metadata={
                    **doc_create.custom_metadata,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "parent_document_id": parent_id
                }
            )
            chunk_docs.append(chunk_create)

        # Create all chunks in batch
        return self.create_documents_batch(chunk_docs)

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a document by ID

        Args:
            doc_id: Document ID

        Returns:
            Document data or None
        """
        return self.chroma.get_document(doc_id)

    def update_document(
        self,
        doc_id: str,
        doc_update: DocumentUpdate
    ) -> bool:
        """
        Update a document

        Args:
            doc_id: Document ID
            doc_update: Update data

        Returns:
            Success status
        """
        # Get current document
        current_doc = self.chroma.get_document(doc_id)
        if not current_doc:
            raise ValueError(f"Document not found: {doc_id}")

        # Update metadata
        metadata = current_doc["metadata"].copy()

        if doc_update.content_type:
            metadata["content_type"] = doc_update.content_type
        if doc_update.title:
            metadata["title"] = doc_update.title
        if doc_update.author:
            metadata["author"] = doc_update.author
        if doc_update.version:
            metadata["version"] = doc_update.version
        if doc_update.tags is not None:
            metadata["tags"] = ",".join(doc_update.tags)
        if doc_update.permissions:
            metadata["permission_users"] = ",".join(doc_update.permissions.users)
            metadata["permission_roles"] = ",".join([r.value for r in doc_update.permissions.roles])
            metadata["permission_access_level"] = doc_update.permissions.access_level.value
        if doc_update.custom_metadata:
            for key, value in doc_update.custom_metadata.items():
                metadata[f"custom_{key}"] = str(value)

        # Update content and regenerate embedding if content changed
        content = doc_update.content if doc_update.content else current_doc["content"]

        if doc_update.content:
            # Regenerate embedding
            embedding = self.embeddings.encode(content)
            # Update in ChromaDB (would need to delete and re-add)
            self.chroma.delete_document(doc_id)
            self.chroma.add_document(
                content=content,
                metadata=metadata,
                embedding=embedding,
                doc_id=doc_id
            )
        else:
            # Just update metadata
            self.chroma.update_document(doc_id, metadata=metadata)

        logger.info(f"Document updated: {doc_id}")
        return True

    def delete_document(self, doc_id: str) -> bool:
        """
        Delete a document

        Args:
            doc_id: Document ID

        Returns:
            Success status
        """
        return self.chroma.delete_document(doc_id)

    def delete_documents_batch(self, doc_ids: List[str]) -> bool:
        """
        Delete multiple documents

        Args:
            doc_ids: List of document IDs

        Returns:
            Success status
        """
        return self.chroma.delete_documents(doc_ids)

    def list_documents(
        self,
        content_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        List documents with optional filters

        Args:
            content_type: Filter by content type
            tags: Filter by tags
            limit: Maximum number of documents

        Returns:
            List of documents
        """
        # This is a simplified implementation
        # In production, you'd want pagination and better filtering
        # ChromaDB doesn't have a direct "list all" method, so we'll use a broad query
        try:
            results = self.chroma.collection.get(
                limit=limit,
                include=["documents", "metadatas"]
            )

            documents = []
            for i, doc_id in enumerate(results["ids"]):
                doc = {
                    "id": doc_id,
                    "content": results["documents"][i],
                    "metadata": results["metadatas"][i]
                }

                # Apply filters
                if content_type and doc["metadata"].get("content_type") != content_type:
                    continue

                if tags:
                    doc_tags = doc["metadata"].get("tags", "").split(",")
                    if not any(tag in doc_tags for tag in tags):
                        continue

                documents.append(doc)

            return documents

        except Exception as e:
            logger.error(f"Error listing documents: {str(e)}")
            return []

    def _split_text(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[str]:
        """
        Split text into chunks

        Args:
            text: Text to split
            chunk_size: Size of each chunk
            chunk_overlap: Overlap between chunks

        Returns:
            List of text chunks
        """
        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at sentence boundary
            if end < len(text):
                # Look for sentence ending
                for delim in ['. ', '.\n', '! ', '?\n', '? ']:
                    pos = text.rfind(delim, start, end)
                    if pos != -1:
                        end = pos + len(delim)
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - chunk_overlap

        return chunks

    def get_stats(self) -> Dict[str, Any]:
        """
        Get document statistics

        Returns:
            Statistics dictionary
        """
        stats = self.chroma.get_collection_stats()

        # Get content type distribution
        all_docs = self.list_documents(limit=1000)
        content_types = {}
        for doc in all_docs:
            ct = doc["metadata"].get("content_type", "unknown")
            content_types[ct] = content_types.get(ct, 0) + 1

        stats["content_type_distribution"] = content_types

        return stats


# Create global instance
document_service = DocumentService()
