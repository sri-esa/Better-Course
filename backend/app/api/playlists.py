from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.playlist import PlaylistIngestRequest, PlaylistResponse
from app.services.youtube import get_or_fetch_playlist

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


@router.post("", response_model=PlaylistResponse)
def ingest_playlist(req: PlaylistIngestRequest, db: Session = Depends(get_db)):
    playlist = get_or_fetch_playlist(db, req.playlist_url, refresh=req.refresh)
    return playlist
