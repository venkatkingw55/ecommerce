import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from .database import get_db
from .models import Cart, CartItem
from .schemas import CartResponse, CartItemResponse, AddToCartRequest, CartItemUpdate

router = APIRouter()

PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://product-service:8002")


async def get_product(product_id: int):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{PRODUCT_SERVICE_URL}/{product_id}")
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None


def get_or_create_cart(user_id: int, db: Session) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def calculate_cart_total(cart_id: int, db: Session) -> float:
    items = db.query(CartItem).filter(CartItem.cart_id == cart_id).all()
    return sum(item.price * item.quantity for item in items)


@router.get("/", response_model=CartResponse)
def get_cart(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    user_id = int(x_user_id)
    cart = get_or_create_cart(user_id, db)
    items = db.query(CartItem).filter(CartItem.cart_id == cart.id).all()
    total = calculate_cart_total(cart.id, db)
    
    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        items=[CartItemResponse.model_validate(item) for item in items],
        total=total,
        created_at=cart.created_at
    )


@router.post("/items", response_model=CartItemResponse, status_code=201)
async def add_to_cart(
    request: AddToCartRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    product = await get_product(request.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product.get("stock", 0) < request.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    user_id = int(x_user_id)
    cart = get_or_create_cart(user_id, db)
    
    existing_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == request.product_id
    ).first()
    
    if existing_item:
        existing_item.quantity += request.quantity
        db.commit()
        db.refresh(existing_item)
        return existing_item
    
    cart_item = CartItem(
        cart_id=cart.id,
        product_id=request.product_id,
        quantity=request.quantity,
        price=product["price"]
    )
    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    return cart_item


@router.put("/items/{item_id}", response_model=CartItemResponse)
def update_cart_item(
    item_id: int,
    update: CartItemUpdate,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    if update.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0. Use DELETE to remove items."
        )
    
    user_id = int(x_user_id)
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    item = db.query(CartItem).filter(
        CartItem.id == item_id,
        CartItem.cart_id == cart.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    
    item.quantity = update.quantity
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
def remove_from_cart(
    item_id: int,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    user_id = int(x_user_id)
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    item = db.query(CartItem).filter(
        CartItem.id == item_id,
        CartItem.cart_id == cart.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    
    db.delete(item)
    db.commit()


@router.delete("/", status_code=204)
def clear_cart(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    user_id = int(x_user_id)
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        db.commit()
