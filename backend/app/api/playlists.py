
from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.mongo import get_database
from app.schemas.playlist import PlaylistIngestRequest, PlaylistResponse
from app.services.youtube import get_or_fetch_playlist

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


@router.post("", response_model=PlaylistResponse)
def ingest_playlist(
    req: PlaylistIngestRequest,
    db: Database = Depends(get_database),
):
    playlist = get_or_fetch_playlist(
        db,
        req.playlist_url,
        refresh=req.refresh,
    )

    return playlist
