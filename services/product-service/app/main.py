from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routes import router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Product Service",
    description="Product catalog management service",
    version="1.0.0",
    root_path="/api/products"
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
    return {"status": "healthy", "service": "product-service"}


app.include_router(router)
