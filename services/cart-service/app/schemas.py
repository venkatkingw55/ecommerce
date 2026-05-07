from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = 1


class CartItemUpdate(BaseModel):
    quantity: int


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: float
    created_at: datetime

    class Config:
        from_attributes = True


class CartResponse(BaseModel):
    id: int
    user_id: int
    items: List[CartItemResponse] = []
    total: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True


class AddToCartRequest(BaseModel):
    product_id: int
    quantity: int = 1
