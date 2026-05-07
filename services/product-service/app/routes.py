from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db
from .models import Product
from .schemas import ProductCreate, ProductUpdate, ProductResponse, ProductList

router = APIRouter()


@router.get("/", response_model=ProductList)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Product).filter(Product.is_active == True)
    
    if category:
        query = query.filter(Product.category == category)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    
    total = query.count()
    products = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return ProductList(
        products=products,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/categories", response_model=List[str])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Product.category).filter(
        Product.category.isnot(None),
        Product.is_active == True
    ).distinct().all()
    return [c[0] for c in categories if c[0]]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductResponse, status_code=201)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product: ProductUpdate,
    db: Session = Depends(get_db)
):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_product, field, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db_product.is_active = False
    db.commit()


@router.patch("/{product_id}/stock", response_model=ProductResponse)
def update_stock(
    product_id: int,
    quantity: int = Query(..., description="Quantity to add (positive) or remove (negative)"),
    db: Session = Depends(get_db)
):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    new_stock = db_product.stock + quantity
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    db_product.stock = new_stock
    db.commit()
    db.refresh(db_product)
    return db_product
