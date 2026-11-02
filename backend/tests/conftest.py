import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "testsecretjwtkeytestsecretjwtkey123"

from app.config import settings
settings.database_url = "sqlite://"
settings.jwt_secret = "testsecretjwtkeytestsecretjwtkey123"

from app.db import Base, get_db
from app.main import app
from app.seed import seed_all

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_all(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)
