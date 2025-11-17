"""
ChromaDB service for vector storage and retrieval
"""
import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import logging

from app.core.config import settings
from app.models.document import DocumentMetadata, Document, PermissionModel, AccessLevel, Role

logger = logging.getLogger(__name__)


class ChromaService:
    """Service for managing ChromaDB operations"""

    def __init__(self):
        """Initialize ChromaDB client and collection"""
        self.client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIRECTORY,
            settings=ChromaSettings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION_NAME,
            metadata={"description": "REFRAG document collection"}
        )

        logger.info(f"ChromaDB initialized with collection: {settings.CHROMA_COLLECTION_NAME}")

    def add_document(
        self,
        content: str,
        metadata: DocumentMetadata,
        embedding: Optional[List[float]] = None,
        doc_id: Optional[str] = None
    ) -> str:
        """
        Add a document to the collection

        Args:
            content: Document content
            metadata: Document metadata
            embedding: Optional pre-computed embedding
            doc_id: Optional document ID

        Returns:
            Document ID
        """
        if doc_id is None:
            doc_id = str(uuid.uuid4())

        # Convert metadata to dict for ChromaDB
        metadata_dict = self._metadata_to_dict(metadata)

        try:
            if embedding:
                self.collection.add(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[metadata_dict],
                    embeddings=[embedding]
                )
            else:
                self.collection.add(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[metadata_dict]
                )

            logger.info(f"Document added successfully: {doc_id}")
            return doc_id

        except Exception as e:
            logger.error(f"Error adding document: {str(e)}")
            raise

    def add_documents_batch(
        self,
        contents: List[str],
        metadatas: List[DocumentMetadata],
        embeddings: Optional[List[List[float]]] = None,
        doc_ids: Optional[List[str]] = None
    ) -> List[str]:
        """
        Add multiple documents in batch

        Args:
            contents: List of document contents
            metadatas: List of document metadata
            embeddings: Optional pre-computed embeddings
            doc_ids: Optional document IDs

        Returns:
            List of document IDs
        """
        if doc_ids is None:
            doc_ids = [str(uuid.uuid4()) for _ in contents]

        # Convert metadata to dicts
        metadata_dicts = [self._metadata_to_dict(m) for m in metadatas]

        try:
            if embeddings:
                self.collection.add(
                    ids=doc_ids,
                    documents=contents,
                    metadatas=metadata_dicts,
                    embeddings=embeddings
                )
            else:
                self.collection.add(
                    ids=doc_ids,
                    documents=contents,
                    metadatas=metadata_dicts
                )

            logger.info(f"Added {len(doc_ids)} documents in batch")
            return doc_ids

        except Exception as e:
            logger.error(f"Error adding documents in batch: {str(e)}")
            raise

    def query_documents(
        self,
        query_texts: List[str],
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
        where_document: Optional[Dict[str, Any]] = None,
        include: List[str] = ["documents", "metadatas", "distances"]
    ) -> Dict[str, Any]:
        """
        Query documents using text

        Args:
            query_texts: List of query texts
            n_results: Number of results to return
            where: Metadata filter
            where_document: Document content filter
            include: Fields to include in results

        Returns:
            Query results
        """
        try:
            results = self.collection.query(
                query_texts=query_texts,
                n_results=n_results,
                where=where,
                where_document=where_document,
                include=include
            )
            return results

        except Exception as e:
            logger.error(f"Error querying documents: {str(e)}")
            raise

    def query_by_embedding(
        self,
        query_embeddings: List[List[float]],
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
        include: List[str] = ["documents", "metadatas", "distances"]
    ) -> Dict[str, Any]:
        """
        Query documents using embeddings

        Args:
            query_embeddings: List of query embeddings
            n_results: Number of results to return
            where: Metadata filter
            include: Fields to include in results

        Returns:
            Query results
        """
        try:
            results = self.collection.query(
                query_embeddings=query_embeddings,
                n_results=n_results,
                where=where,
                include=include
            )
            return results

        except Exception as e:
            logger.error(f"Error querying by embedding: {str(e)}")
            raise

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a document by ID

        Args:
            doc_id: Document ID

        Returns:
            Document data or None
        """
        try:
            results = self.collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"]
            )

            if results["ids"]:
                return {
                    "id": results["ids"][0],
                    "content": results["documents"][0],
                    "metadata": results["metadatas"][0]
                }
            return None

        except Exception as e:
            logger.error(f"Error getting document: {str(e)}")
            raise

    def update_document(
        self,
        doc_id: str,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Update a document

        Args:
            doc_id: Document ID
            content: New content
            metadata: New metadata

        Returns:
            Success status
        """
        try:
            update_dict = {"ids": [doc_id]}

            if content:
                update_dict["documents"] = [content]

            if metadata:
                # Update timestamp
                metadata["updated_at"] = datetime.now().isoformat()
                update_dict["metadatas"] = [metadata]

            self.collection.update(**update_dict)
            logger.info(f"Document updated: {doc_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating document: {str(e)}")
            raise

    def delete_document(self, doc_id: str) -> bool:
        """
        Delete a document

        Args:
            doc_id: Document ID

        Returns:
            Success status
        """
        try:
            self.collection.delete(ids=[doc_id])
            logger.info(f"Document deleted: {doc_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting document: {str(e)}")
            raise

    def delete_documents(self, doc_ids: List[str]) -> bool:
        """
        Delete multiple documents

        Args:
            doc_ids: List of document IDs

        Returns:
            Success status
        """
        try:
            self.collection.delete(ids=doc_ids)
            logger.info(f"Deleted {len(doc_ids)} documents")
            return True

        except Exception as e:
            logger.error(f"Error deleting documents: {str(e)}")
            raise

    def get_collection_stats(self) -> Dict[str, Any]:
        """
        Get collection statistics

        Returns:
            Collection stats
        """
        try:
            count = self.collection.count()
            return {
                "name": settings.CHROMA_COLLECTION_NAME,
                "document_count": count,
                "metadata": self.collection.metadata
            }

        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}")
            raise

    def reset_collection(self) -> bool:
        """
        Reset the collection (delete all documents)

        Returns:
            Success status
        """
        try:
            self.client.delete_collection(settings.CHROMA_COLLECTION_NAME)
            self.collection = self.client.create_collection(
                name=settings.CHROMA_COLLECTION_NAME,
                metadata={"description": "REFRAG document collection"}
            )
            logger.warning("Collection reset - all documents deleted")
            return True

        except Exception as e:
            logger.error(f"Error resetting collection: {str(e)}")
            raise

    def _metadata_to_dict(self, metadata: DocumentMetadata) -> Dict[str, Any]:
        """
        Convert DocumentMetadata to dict for ChromaDB

        Args:
            metadata: DocumentMetadata object

        Returns:
            Dictionary representation
        """
        # ChromaDB only supports primitive types in metadata
        # We need to flatten complex objects
        meta_dict = {
            "id": metadata.id,
            "content_type": metadata.content_type,
            "title": metadata.title,
            "source": metadata.source,
            "author": metadata.author or "",
            "created_at": metadata.created_at.isoformat(),
            "updated_at": metadata.updated_at.isoformat(),
            "version": metadata.version,
            "tags": ",".join(metadata.tags),  # Comma-separated string
            "language": metadata.language,
            "file_type": metadata.file_type,
            "size": metadata.size,
            "chunk_index": metadata.chunk_index or -1,
            "parent_document_id": metadata.parent_document_id or "",
            # Flatten permissions
            "permission_users": ",".join(metadata.permissions.users),
            "permission_roles": ",".join([r.value for r in metadata.permissions.roles]),
            "permission_access_level": metadata.permissions.access_level.value,
        }

        # Add custom metadata with prefix
        for key, value in metadata.custom_metadata.items():
            meta_dict[f"custom_{key}"] = str(value)

        return meta_dict

    def build_permission_filter(
        self,
        user_id: Optional[str] = None,
        user_roles: Optional[List[Role]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Build permission filter for queries

        Args:
            user_id: User ID
            user_roles: User roles

        Returns:
            ChromaDB where filter or None
        """
        # For simplicity, we'll filter in post-processing
        # ChromaDB's where clause has limitations with OR conditions
        return None


# Create global instance
chroma_service = ChromaService()
