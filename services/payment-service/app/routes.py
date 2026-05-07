import os
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from typing import Optional

from .database import get_db
from .models import Order, OrderItem, Payment, OrderStatus, PaymentStatus
from .schemas import (
    CheckoutRequest, OrderResponse, OrderItemResponse,
    PaymentResponse, OrderListResponse
)

router = APIRouter()

CART_SERVICE_URL = os.getenv("CART_SERVICE_URL", "http://cart-service:8003")
PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://product-service:8002")


async def get_cart(user_id: int):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{CART_SERVICE_URL}/",
                headers={"X-User-ID": str(user_id)}
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None


async def clear_cart(user_id: int):
    async with httpx.AsyncClient() as client:
        try:
            await client.delete(
                f"{CART_SERVICE_URL}/",
                headers={"X-User-ID": str(user_id)}
            )
        except Exception:
            pass


async def update_product_stock(product_id: int, quantity: int):
    async with httpx.AsyncClient() as client:
        try:
            await client.patch(
                f"{PRODUCT_SERVICE_URL}/{product_id}/stock",
                params={"quantity": -quantity}
            )
        except Exception:
            pass


@router.post("/checkout", response_model=OrderResponse, status_code=201)
async def checkout(
    request: CheckoutRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    user_id = int(x_user_id)
    cart = await get_cart(user_id)
    
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    order = Order(
        user_id=user_id,
        total_amount=cart["total"],
        shipping_address=request.shipping_address,
        status=OrderStatus.PENDING.value
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    order_items = []
    for item in cart["items"]:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item["product_id"],
            quantity=item["quantity"],
            price=item["price"]
        )
        db.add(order_item)
        order_items.append(order_item)
        await update_product_stock(item["product_id"], item["quantity"])
    
    db.commit()
    
    payment = Payment(
        order_id=order.id,
        amount=order.total_amount,
        payment_method=request.payment_method,
        status=PaymentStatus.COMPLETED.value,
        transaction_id=str(uuid.uuid4())
    )
    db.add(payment)
    
    order.status = OrderStatus.PAID.value
    db.commit()
    
    await clear_cart(user_id)
    
    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        total_amount=order.total_amount,
        status=order.status,
        shipping_address=order.shipping_address,
        items=[OrderItemResponse.model_validate(item) for item in order_items],
        created_at=order.created_at
    )


@router.get("/orders", response_model=OrderListResponse)
def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    user_id = int(x_user_id)
    query = db.query(Order).filter(Order.user_id == user_id)
    total = query.count()
    orders = query.order_by(Order.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    order_responses = []
    for order in orders:
        items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        order_responses.append(OrderResponse(
            id=order.id,
            user_id=order.user_id,
            total_amount=order.total_amount,
            status=order.status,
            shipping_address=order.shipping_address,
            items=[OrderItemResponse.model_validate(item) for item in items],
            created_at=order.created_at
        ))
    
    return OrderListResponse(orders=order_responses, total=total)


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    user_id = int(x_user_id)
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    
    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        total_amount=order.total_amount,
        status=order.status,
        shipping_address=order.shipping_address,
        items=[OrderItemResponse.model_validate(item) for item in items],
        created_at=order.created_at
    )


@router.get("/orders/{order_id}/payment", response_model=PaymentResponse)
def get_payment(
    order_id: int,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    user_id = int(x_user_id)
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return payment
