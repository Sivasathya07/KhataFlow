"""HTTP adapters for the inventory workflow."""

from datetime import datetime
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.dependencies import require_roles
from app.config import Settings, get_settings
from app.database.mongo import get_database
from app.models.product import Product
from app.repositories.product_repository import MongoProductRepository
from app.schemas.product import ProductCreate, ProductDetail, ProductSummary, ProductUpdate
from app.services.product_service import ProductService

router = APIRouter(prefix="/inventory/products", tags=["inventory"])
optional_bearer = HTTPBearer(auto_error=False)


def get_product_service() -> ProductService:
    return ProductService(MongoProductRepository(get_database()["products"]))


def get_business_id(credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer), settings: Settings = Depends(get_settings)) -> UUID:
    """Resolve the JWT tenant; only local development may use the seeded tenant."""
    if credentials is None:
        if settings.environment.casefold() == "development":
            return settings.default_business_id
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if claims.get("type") != "access":
            raise jwt.InvalidTokenError("Access token required")
        return UUID(claims["businessId"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc


def to_summary(product: Product) -> ProductSummary:
    return ProductSummary(
        id=product.public_id,
        name=product.name,
        sku=product.sku,
        barcode=product.barcode,
        category=product.category,
        sellingPrice=product.pricing.selling_price,
        currency=product.pricing.currency,
        quantityOnHand=product.inventory.quantity_on_hand,
        reorderLevel=product.inventory.reorder_level,
        unit=product.inventory.unit,
        isActive=product.is_active,
        version=product.version,
    )


def to_detail(product: Product) -> ProductDetail:
    return ProductDetail(
        **to_summary(product).model_dump(),
        costPrice=product.pricing.cost_price,
        taxRate=product.pricing.tax_rate,
        trackInventory=product.inventory.track_inventory,
        supplierIds=[str(value) for value in product.supplier_ids],
        createdAt=product.created_at.isoformat(),
        updatedAt=product.updated_at.isoformat(),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, business_id: UUID = Depends(get_business_id), service: ProductService = Depends(get_product_service)) -> dict[str, ProductDetail]:
    return {"data": to_detail(service.create_product(business_id, payload))}


@router.get("")
def list_products(
    query: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=100),
    include_inactive: bool = Query(default=False, alias="includeInactive"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    business_id: UUID = Depends(get_business_id),
    service: ProductService = Depends(get_product_service),
) -> dict:
    products, total = service.list_products(business_id, query, category, include_inactive, page, limit)
    return {"data": [to_summary(product) for product in products], "pagination": {"page": page, "limit": limit, "total": total}}


@router.get("/{product_id}")
def get_product(product_id: UUID, business_id: UUID = Depends(get_business_id), service: ProductService = Depends(get_product_service)) -> dict[str, ProductDetail]:
    return {"data": to_detail(service.get_product(business_id, product_id))}


@router.patch("/{product_id}")
def update_product(product_id: UUID, payload: ProductUpdate, business_id: UUID = Depends(get_business_id), service: ProductService = Depends(get_product_service)) -> dict[str, ProductDetail]:
    return {"data": to_detail(service.update_product(business_id, product_id, payload))}


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: UUID,
    business_id: UUID = Depends(get_business_id),
    service: ProductService = Depends(get_product_service),
    _: dict = Depends(require_roles("owner", "manager")),
) -> Response:
    service.delete_product(business_id, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
