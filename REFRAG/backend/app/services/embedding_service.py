"""
Embedding service using sentence-transformers
"""
from sentence_transformers import SentenceTransformer
from typing import List, Union
import logging
import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating text embeddings"""

    def __init__(self):
        """Initialize embedding model"""
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        self.model = SentenceTransformer(
            settings.EMBEDDING_MODEL,
            device=settings.EMBEDDING_DEVICE
        )
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        logger.info(f"Embedding model loaded. Dimension: {self.embedding_dim}")

    def encode(
        self,
        texts: Union[str, List[str]],
        batch_size: int = 32,
        show_progress: bool = False,
        normalize: bool = True
    ) -> Union[List[float], List[List[float]]]:
        """
        Encode text(s) into embeddings

        Args:
            texts: Single text or list of texts
            batch_size: Batch size for encoding
            show_progress: Show progress bar
            normalize: Normalize embeddings

        Returns:
            Single embedding or list of embeddings
        """
        try:
            # Handle single string
            single_input = isinstance(texts, str)
            if single_input:
                texts = [texts]

            # Generate embeddings
            embeddings = self.model.encode(
                texts,
                batch_size=batch_size,
                show_progress_bar=show_progress,
                normalize_embeddings=normalize,
                convert_to_numpy=True
            )

            # Convert to list
            embeddings_list = embeddings.tolist()

            # Return single embedding if single input
            if single_input:
                return embeddings_list[0]

            return embeddings_list

        except Exception as e:
            logger.error(f"Error encoding texts: {str(e)}")
            raise

    def similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """
        Calculate cosine similarity between two embeddings

        Args:
            embedding1: First embedding
            embedding2: Second embedding

        Returns:
            Similarity score (0-1)
        """
        try:
            # Convert to numpy arrays
            emb1 = np.array(embedding1)
            emb2 = np.array(embedding2)

            # Calculate cosine similarity
            similarity = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

            return float(similarity)

        except Exception as e:
            logger.error(f"Error calculating similarity: {str(e)}")
            raise

    def batch_similarity(
        self,
        query_embedding: List[float],
        document_embeddings: List[List[float]]
    ) -> List[float]:
        """
        Calculate similarity between query and multiple documents

        Args:
            query_embedding: Query embedding
            document_embeddings: List of document embeddings

        Returns:
            List of similarity scores
        """
        try:
            query_emb = np.array(query_embedding)
            doc_embs = np.array(document_embeddings)

            # Calculate cosine similarities
            similarities = np.dot(doc_embs, query_emb) / (
                np.linalg.norm(doc_embs, axis=1) * np.linalg.norm(query_emb)
            )

            return similarities.tolist()

        except Exception as e:
            logger.error(f"Error calculating batch similarity: {str(e)}")
            raise


# Create global instance
embedding_service = EmbeddingService()
