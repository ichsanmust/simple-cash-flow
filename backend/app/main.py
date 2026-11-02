from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .db import Base, SessionLocal, engine
from .routers import (
    ai_models,
    auth,
    categories,
    currencies,
    expenses,
    incomes,
    reports,
    settings as settings_router,
    transactions,
    users,
)
from .seed import seed_all

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("simple-cash-flow")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Inisialisasi tabel database...")
    Base.metadata.create_all(bind=engine)
    log.info("Menjalankan data seed awal...")
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()
    yield
    log.info("Aplikasi dimatikan.")


app = FastAPI(
    title="Simple Cashflow API",
    version="1.0.0",
    description="Backend API untuk aplikasi Simple Cashflow dengan AI Expense Extractor dan Pemasukan Manual",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handlers
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    log.exception("Database error occurred: %s", str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": f"Database error: {str(exc)}"},
    )


# Include Routers dengan prefix /api
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(currencies.router, prefix="/api")
app.include_router(incomes.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(ai_models.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")


@app.get("/")
def root():
    return {
        "status": "online",
        "app": "Simple Cashflow API",
        "docs_url": "/docs",
    }

