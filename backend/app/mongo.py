
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app.config import get_settings

_client: MongoClient | None = None
_database: Database | None = None


def ensure_indexes(db: Database) -> None:
    """Create indexes required by the Syllabify application."""

    db.playlists.create_index(
        [("youtube_playlist_id", ASCENDING)],
        unique=True,
        name="uq_playlists_youtube_playlist_id",
    )

    db.videos.create_index(
        [("playlist_id", ASCENDING), ("youtube_video_id", ASCENDING)],
        unique=True,
        name="uq_playlist_video",
    )
    db.videos.create_index(
        [("playlist_id", ASCENDING), ("position", ASCENDING)],
        name="ix_playlist_position",
    )

    db.clusterings.create_index(
        [
            ("playlist_id", ASCENDING),
            ("method", ASCENDING),
            ("videos_hash", ASCENDING),
        ],
        unique=True,
        name="uq_playlist_method_hash",
    )

    db.plans.create_index(
        [("playlist_id", ASCENDING)],
        name="ix_plans_playlist_id",
    )

    db.progress.create_index(
        [("plan_id", ASCENDING), ("youtube_video_id", ASCENDING)],
        unique=True,
        name="uq_plan_video_progress",
    )


def connect_to_mongodb() -> Database:
    """Connect to MongoDB Atlas and initialize required indexes."""

    global _client, _database

    if _database is not None:
        return _database

    settings = get_settings()

    if not settings.MONGODB_URI:
        raise RuntimeError("MONGODB_URI is missing from the environment.")

    if not settings.MONGODB_USERNAME or not settings.MONGODB_PASSWORD:
        raise RuntimeError("MongoDB username or password is missing.")

    _client = MongoClient(
        settings.MONGODB_URI,
        username=settings.MONGODB_USERNAME,
        password=settings.MONGODB_PASSWORD,
        authSource="admin",
        serverSelectionTimeoutMS=15000,
        connectTimeoutMS=10000,
        appName="Syllabify-Backend",
    )

    try:
        _client.admin.command("ping")
        _database = _client[settings.MONGODB_DATABASE]
        ensure_indexes(_database)
        return _database

    except Exception:
        _client.close()
        _client = None
        _database = None
        raise


def get_database() -> Database:
    """Return the connected MongoDB database."""

    if _database is None:
        raise RuntimeError("MongoDB is not connected.")

    return _database


def close_mongodb() -> None:
    """Close the MongoDB connection."""

    global _client, _database

    if _client is not None:
        _client.close()

    _client = None
    _database = None
