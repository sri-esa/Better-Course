"""Initial database schema

Revision ID: 001_initial
Revises:
Create Date: 2026-10-07 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "playlists",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("youtube_playlist_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("channel_title", sa.String(255), nullable=False),
        sa.Column("video_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_playlists_youtube_playlist_id", "playlists", ["youtube_playlist_id"], unique=True)

    op.create_table(
        "videos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("playlist_id", sa.String(36), sa.ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("youtube_video_id", sa.String(64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("thumbnail_url", sa.String(1000), nullable=True),
        sa.UniqueConstraint("playlist_id", "youtube_video_id", name="uq_playlist_video"),
    )
    op.create_index("ix_videos_playlist_id", "videos", ["playlist_id"])
    op.create_index("ix_videos_youtube_video_id", "videos", ["youtube_video_id"])
    op.create_index("ix_playlist_position", "videos", ["playlist_id", "position"])

    op.create_table(
        "clusterings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("playlist_id", sa.String(36), sa.ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("method", sa.String(32), nullable=False),
        sa.Column("method_used", sa.String(32), nullable=False),
        sa.Column("videos_hash", sa.String(64), nullable=False),
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("playlist_id", "method", "videos_hash", name="uq_playlist_method_hash"),
    )
    op.create_index("ix_clusterings_playlist_id", "clusterings", ["playlist_id"])

    op.create_table(
        "plans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("playlist_id", sa.String(36), sa.ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hours_per_week", sa.Float(), nullable=False),
        sa.Column("start_date", sa.String(10), nullable=False),
        sa.Column("target_date", sa.String(10), nullable=True),
        sa.Column("topics_json", sa.JSON(), nullable=False),
        sa.Column("schedule_json", sa.JSON(), nullable=False),
        sa.Column("feasible", sa.Boolean(), nullable=False),
        sa.Column("required_hours_per_week", sa.Float(), nullable=True),
        sa.Column("pace_factor", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("replan_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clustering_method_used", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_plans_playlist_id", "plans", ["playlist_id"])

    op.create_table(
        "progress",
        sa.Column("plan_id", sa.String(36), sa.ForeignKey("plans.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("youtube_video_id", sa.String(64), primary_key=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("actual_seconds", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("progress")
    op.drop_table("plans")
    op.drop_table("clusterings")
    op.drop_table("videos")
    op.drop_table("playlists")
