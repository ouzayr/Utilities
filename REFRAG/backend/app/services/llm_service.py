"""
LLM service for Ollama integration
"""
import requests
import json
from typing import List, Dict, Any, Optional, Generator
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    """Service for interacting with Ollama LLM"""

    def __init__(self):
        """Initialize Ollama service"""
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT
        logger.info(f"Ollama service initialized with model: {self.model}")

    def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False
    ) -> str:
        """
        Generate text using Ollama

        Args:
            prompt: Input prompt
            model: Model name (uses default if not specified)
            system: System prompt
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            stream: Enable streaming

        Returns:
            Generated text
        """
        model_name = model or self.model

        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": temperature,
            }
        }

        if system:
            payload["system"] = system

        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()

            result = response.json()
            return result.get("response", "")

        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling Ollama API: {str(e)}")
            raise

    def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Chat completion using Ollama

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model name
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Returns:
            Assistant's response
        """
        model_name = model or self.model

        payload = {
            "model": model_name,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            }
        }

        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()

            result = response.json()
            return result.get("message", {}).get("content", "")

        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling Ollama chat API: {str(e)}")
            raise

    def generate_with_context(
        self,
        query: str,
        context_documents: List[str],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7
    ) -> str:
        """
        Generate response with context documents (RAG)

        Args:
            query: User query
            context_documents: List of context documents
            system_prompt: System prompt
            temperature: Sampling temperature

        Returns:
            Generated response
        """
        # Build context
        context = "\n\n".join([
            f"Document {i+1}:\n{doc}"
            for i, doc in enumerate(context_documents)
        ])

        # Build prompt
        prompt = f"""Context Documents:
{context}

User Query: {query}

Based on the context documents above, provide a comprehensive answer to the user's query. If the context doesn't contain relevant information, say so clearly."""

        default_system = "You are a helpful AI assistant that answers questions based on the provided context documents. Be precise, informative, and cite relevant parts of the context when appropriate."

        return self.generate(
            prompt=prompt,
            system=system_prompt or default_system,
            temperature=temperature
        )

    def decompose_query(self, query: str) -> List[str]:
        """
        Decompose complex query into sub-queries

        Args:
            query: Complex query

        Returns:
            List of sub-queries
        """
        system_prompt = """You are a query decomposition expert. When given a complex question, break it down into simpler, focused sub-questions that can be answered independently. Return ONLY the sub-questions, one per line, without numbering or additional text."""

        prompt = f"""Decompose this query into 2-4 simpler sub-questions:

Query: {query}

Sub-questions:"""

        try:
            response = self.generate(
                prompt=prompt,
                system=system_prompt,
                temperature=0.3
            )

            # Parse sub-queries
            sub_queries = [
                q.strip().lstrip("0123456789.-) ")
                for q in response.strip().split("\n")
                if q.strip()
            ]

            return sub_queries[:4]  # Limit to 4 sub-queries

        except Exception as e:
            logger.error(f"Error decomposing query: {str(e)}")
            # Return original query if decomposition fails
            return [query]

    def check_health(self) -> bool:
        """
        Check if Ollama service is running

        Returns:
            True if healthy, False otherwise
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/tags",
                timeout=5
            )
            return response.status_code == 200

        except requests.exceptions.RequestException:
            return False

    def list_models(self) -> List[Dict[str, Any]]:
        """
        List available models

        Returns:
            List of model information
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/tags",
                timeout=10
            )
            response.raise_for_status()

            result = response.json()
            return result.get("models", [])

        except requests.exceptions.RequestException as e:
            logger.error(f"Error listing models: {str(e)}")
            return []


# Create global instance
llm_service = OllamaService()
