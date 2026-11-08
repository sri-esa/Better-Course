
import os

import mongomock
import pytest

# Ensure tests never connect to the real MongoDB Atlas database.
os.environ["TESTING"] = "true"
os.environ["ENVIRONMENT"] = "test"

from app import mongo


@pytest.fixture(autouse=True)
def isolated_mongodb():
    """Give every test a fresh, isolated in-memory MongoDB database."""

    client = mongomock.MongoClient(tz_aware=True)
    database = client["syllabify_test"]

    mongo._client = client
    mongo._database = database

    mongo.ensure_indexes(database)

    yield database

    client.close()
    mongo._client = None
    mongo._database = None


@pytest.fixture
def mongo_db(isolated_mongodb):
    return isolated_mongodb


@pytest.fixture
def mock_db(mongo_db):
    return mongo_db


@pytest.fixture
def test_db(mongo_db):
    return mongo_db


@pytest.fixture
def db_session(mongo_db):
    """Temporary compatibility alias for converted model tests."""
    return mongo_db
