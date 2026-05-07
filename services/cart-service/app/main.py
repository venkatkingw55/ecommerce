from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routes import router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Cart Service",
    description="Shopping cart management service",
    version="1.0.0",
    root_path="/api/cart"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "cart-service"}


app.include_router(router)
