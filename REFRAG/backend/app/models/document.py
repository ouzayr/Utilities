"""
Document and metadata models for REFRAG
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class AccessLevel(str, Enum):
    """Access level enumeration"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class Role(str, Enum):
    """User role enumeration"""
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    GUEST = "guest"


class PermissionModel(BaseModel):
    """Permission model for documents"""
    users: List[str] = Field(default_factory=list, description="Specific user IDs with access")
    roles: List[Role] = Field(default_factory=list, description="Roles with access")
    access_level: AccessLevel = Field(default=AccessLevel.INTERNAL, description="Document access level")


class DocumentMetadata(BaseModel):
    """Metadata schema for documents"""
    id: str = Field(..., description="Unique document identifier")
    content_type: str = Field(..., description="Type of content (policy, faq, manual, etc.)")
    title: str = Field(..., description="Document title")
    source: str = Field(..., description="Source file path or URL")
    author: Optional[str] = Field(None, description="Document author")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")
    version: str = Field(default="1.0.0", description="Document version")
    tags: List[str] = Field(default_factory=list, description="Document tags")
    permissions: PermissionModel = Field(default_factory=PermissionModel, description="Permission settings")
    language: str = Field(default="en", description="Document language")
    file_type: str = Field(..., description="File type (pdf, txt, docx, md)")
    size: int = Field(default=0, description="Document size in bytes")
    chunk_index: Optional[int] = Field(None, description="Chunk index for chunked documents")
    parent_document_id: Optional[str] = Field(None, description="Parent document ID if chunked")
    custom_metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional custom metadata")

    class Config:
        use_enum_values = True


class Document(BaseModel):
    """Document model with content and metadata"""
    id: str
    content: str
    metadata: DocumentMetadata
    embedding: Optional[List[float]] = None


class DocumentCreate(BaseModel):
    """Model for creating new documents"""
    content: str
    content_type: str
    title: str
    source: str
    author: Optional[str] = None
    version: str = "1.0.0"
    tags: List[str] = Field(default_factory=list)
    permissions: Optional[PermissionModel] = None
    language: str = "en"
    file_type: str = "txt"
    custom_metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    """Model for updating existing documents"""
    content: Optional[str] = None
    content_type: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None
    version: Optional[str] = None
    tags: Optional[List[str]] = None
    permissions: Optional[PermissionModel] = None
    custom_metadata: Optional[Dict[str, Any]] = None


class QueryRequest(BaseModel):
    """Model for query requests"""
    query: str = Field(..., description="User query")
    user_id: Optional[str] = Field(None, description="User ID for permission filtering")
    user_roles: List[Role] = Field(default_factory=list, description="User roles")
    content_types: Optional[List[str]] = Field(None, description="Filter by content types")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    top_k: int = Field(default=5, description="Number of documents to retrieve")
    enable_refrag: bool = Field(default=True, description="Enable REFRAG iterative retrieval")


class QueryResponse(BaseModel):
    """Model for query responses"""
    query: str
    answer: str
    retrieved_documents: List[Dict[str, Any]]
    retrieval_iterations: int
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentResponse(BaseModel):
    """Model for document responses"""
    id: str
    content: str
    metadata: DocumentMetadata
    score: Optional[float] = None
