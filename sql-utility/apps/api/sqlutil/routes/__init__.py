from fastapi import APIRouter

from . import checks, connections, diff as diff_routes, erd, graph, health, introspect, metadata, query

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(connections.router, prefix="/connections", tags=["connections"])
api_router.include_router(introspect.router, prefix="/connections/{connection_id}", tags=["introspect"])
api_router.include_router(checks.router, prefix="/connections/{connection_id}", tags=["checks"])
api_router.include_router(erd.router, prefix="/connections/{connection_id}", tags=["erd"])
api_router.include_router(graph.router, prefix="/connections/{connection_id}", tags=["graph"])
api_router.include_router(metadata.router, prefix="/connections/{connection_id}/metadata", tags=["metadata"])
api_router.include_router(diff_routes.router, prefix="/diff", tags=["diff"])
api_router.include_router(query.router, prefix="/connections/{connection_id}/query", tags=["query"])

__all__ = ["api_router"]
