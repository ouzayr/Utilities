"""
REFRAG service implementing iterative retrieval and query refinement
"""
from typing import List, Dict, Any, Optional, Tuple
import logging
from datetime import datetime

from app.core.config import settings
from app.services.chroma_service import chroma_service
from app.services.embedding_service import embedding_service
from app.services.llm_service import llm_service
from app.models.document import QueryRequest, QueryResponse, Role, AccessLevel

logger = logging.getLogger(__name__)


class REFRAGService:
    """
    REFRAG (Retrieval-Enhanced Forward-looking Active Generation) Service

    Implements:
    - Iterative retrieval during generation
    - Query decomposition for complex questions
    - Contextual refinement
    - Relevance re-ranking
    """

    def __init__(self):
        """Initialize REFRAG service"""
        self.chroma = chroma_service
        self.embeddings = embedding_service
        self.llm = llm_service
        logger.info("REFRAG service initialized")

    def query(
        self,
        request: QueryRequest
    ) -> QueryResponse:
        """
        Process query using REFRAG methodology

        Args:
            request: Query request with parameters

        Returns:
            Query response with answer and retrieved documents
        """
        logger.info(f"Processing query: {request.query[:100]}...")

        if request.enable_refrag and settings.ENABLE_QUERY_DECOMPOSITION:
            # Use REFRAG with query decomposition and iterative retrieval
            return self._refrag_query(request)
        else:
            # Standard RAG query
            return self._standard_query(request)

    def _standard_query(self, request: QueryRequest) -> QueryResponse:
        """
        Standard RAG query without REFRAG

        Args:
            request: Query request

        Returns:
            Query response
        """
        # Retrieve documents
        retrieved_docs = self._retrieve_documents(
            query=request.query,
            top_k=request.top_k,
            content_types=request.content_types,
            tags=request.tags,
            user_id=request.user_id,
            user_roles=request.user_roles
        )

        # Generate answer
        context_texts = [doc["content"] for doc in retrieved_docs]
        answer = self.llm.generate_with_context(
            query=request.query,
            context_documents=context_texts
        )

        return QueryResponse(
            query=request.query,
            answer=answer,
            retrieved_documents=retrieved_docs,
            retrieval_iterations=1,
            metadata={
                "method": "standard_rag",
                "num_documents": len(retrieved_docs)
            }
        )

    def _refrag_query(self, request: QueryRequest) -> QueryResponse:
        """
        REFRAG query with iterative retrieval and query decomposition

        Args:
            request: Query request

        Returns:
            Query response
        """
        all_retrieved_docs = []
        retrieval_iterations = 0

        # Step 1: Decompose query into sub-queries
        sub_queries = self._decompose_query(request.query)
        logger.info(f"Decomposed into {len(sub_queries)} sub-queries")

        # Step 2: Iterative retrieval for each sub-query
        for iteration, sub_query in enumerate(sub_queries):
            if iteration >= settings.MAX_RETRIEVAL_ITERATIONS:
                break

            logger.info(f"Iteration {iteration + 1}: {sub_query[:100]}...")

            # Retrieve documents for this sub-query
            docs = self._retrieve_documents(
                query=sub_query,
                top_k=request.top_k,
                content_types=request.content_types,
                tags=request.tags,
                user_id=request.user_id,
                user_roles=request.user_roles
            )

            # Add to all retrieved docs (with deduplication)
            for doc in docs:
                if not any(d["id"] == doc["id"] for d in all_retrieved_docs):
                    all_retrieved_docs.append(doc)

            retrieval_iterations += 1

        # Step 3: Re-rank documents if enabled
        if settings.ENABLE_RERANKING and all_retrieved_docs:
            all_retrieved_docs = self._rerank_documents(
                query=request.query,
                documents=all_retrieved_docs
            )

        # Step 4: Generate final answer with all context
        context_texts = [doc["content"] for doc in all_retrieved_docs[:request.top_k]]
        answer = self._generate_refrag_answer(
            query=request.query,
            sub_queries=sub_queries,
            context_documents=context_texts
        )

        return QueryResponse(
            query=request.query,
            answer=answer,
            retrieved_documents=all_retrieved_docs[:request.top_k],
            retrieval_iterations=retrieval_iterations,
            metadata={
                "method": "refrag",
                "sub_queries": sub_queries,
                "total_documents_retrieved": len(all_retrieved_docs),
                "reranking_enabled": settings.ENABLE_RERANKING
            }
        )

    def _retrieve_documents(
        self,
        query: str,
        top_k: int = 5,
        content_types: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        user_id: Optional[str] = None,
        user_roles: Optional[List[Role]] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve documents from ChromaDB

        Args:
            query: Query text
            top_k: Number of documents to retrieve
            content_types: Filter by content types
            tags: Filter by tags
            user_id: User ID for permission filtering
            user_roles: User roles for permission filtering

        Returns:
            List of retrieved documents with metadata
        """
        # Query ChromaDB
        results = self.chroma.query_documents(
            query_texts=[query],
            n_results=top_k * 2,  # Retrieve more for filtering
            include=["documents", "metadatas", "distances"]
        )

        # Process results
        documents = []
        for i, doc_id in enumerate(results["ids"][0]):
            doc = {
                "id": doc_id,
                "content": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "score": 1 - results["distances"][0][i]  # Convert distance to similarity
            }

            # Apply filters
            if content_types and doc["metadata"]["content_type"] not in content_types:
                continue

            if tags:
                doc_tags = doc["metadata"].get("tags", "").split(",")
                if not any(tag in doc_tags for tag in tags):
                    continue

            # Apply permission filtering
            if not self._check_permissions(doc["metadata"], user_id, user_roles):
                continue

            # Only include if above similarity threshold
            if doc["score"] >= settings.SIMILARITY_THRESHOLD:
                documents.append(doc)

        # Return top_k documents
        return documents[:top_k]

    def _check_permissions(
        self,
        metadata: Dict[str, Any],
        user_id: Optional[str],
        user_roles: Optional[List[Role]]
    ) -> bool:
        """
        Check if user has permission to access document

        Args:
            metadata: Document metadata
            user_id: User ID
            user_roles: User roles

        Returns:
            True if user has access, False otherwise
        """
        access_level = metadata.get("permission_access_level", "internal")

        # Public documents are accessible to everyone
        if access_level == "public":
            return True

        # Check user-based permissions
        if user_id:
            allowed_users = metadata.get("permission_users", "").split(",")
            if user_id in allowed_users:
                return True

        # Check role-based permissions
        if user_roles:
            allowed_roles = metadata.get("permission_roles", "").split(",")
            for role in user_roles:
                if role.value in allowed_roles:
                    return True

        # Default: deny access for confidential/restricted, allow for internal
        return access_level == "internal"

    def _decompose_query(self, query: str) -> List[str]:
        """
        Decompose complex query into sub-queries

        Args:
            query: Original query

        Returns:
            List of sub-queries (including original)
        """
        try:
            sub_queries = self.llm.decompose_query(query)
            # Always include the original query
            if query not in sub_queries:
                sub_queries.insert(0, query)
            return sub_queries
        except Exception as e:
            logger.error(f"Error decomposing query: {str(e)}")
            return [query]

    def _rerank_documents(
        self,
        query: str,
        documents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Re-rank documents based on relevance to original query

        Args:
            query: Original query
            documents: Retrieved documents

        Returns:
            Re-ranked documents
        """
        try:
            # Get query embedding
            query_embedding = self.embeddings.encode(query)

            # Get document embeddings
            doc_texts = [doc["content"] for doc in documents]
            doc_embeddings = self.embeddings.encode(doc_texts)

            # Calculate similarities
            similarities = self.embeddings.batch_similarity(
                query_embedding,
                doc_embeddings
            )

            # Update scores and sort
            for i, doc in enumerate(documents):
                doc["score"] = similarities[i]

            # Sort by score
            documents.sort(key=lambda x: x["score"], reverse=True)

            return documents

        except Exception as e:
            logger.error(f"Error re-ranking documents: {str(e)}")
            return documents

    def _generate_refrag_answer(
        self,
        query: str,
        sub_queries: List[str],
        context_documents: List[str]
    ) -> str:
        """
        Generate answer using REFRAG methodology

        Args:
            query: Original query
            sub_queries: Decomposed sub-queries
            context_documents: Retrieved context documents

        Returns:
            Generated answer
        """
        # Build enhanced prompt
        context = "\n\n".join([
            f"Document {i+1}:\n{doc}"
            for i, doc in enumerate(context_documents)
        ])

        sub_queries_text = "\n".join([f"- {sq}" for sq in sub_queries])

        prompt = f"""You are answering a complex question using retrieved context documents.

Original Question: {query}

The question has been broken down into these sub-questions:
{sub_queries_text}

Context Documents:
{context}

Instructions:
1. Analyze the context documents to find information relevant to the original question and sub-questions
2. Synthesize a comprehensive answer that addresses all aspects of the query
3. Cite specific documents when referencing information
4. If the context doesn't fully answer the question, acknowledge what's missing

Provide a clear, well-structured answer:"""

        system_prompt = "You are a helpful AI assistant that provides comprehensive, accurate answers based on retrieved context documents. Be thorough but concise, and always ground your answers in the provided context."

        return self.llm.generate(
            prompt=prompt,
            system=system_prompt,
            temperature=0.7
        )


# Create global instance
refrag_service = REFRAGService()
