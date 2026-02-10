"""add sequence column to firewall_rules

Revision ID: a1b2c3d4e5f6
Revises: 5c3dc505331c
Create Date: 2026-02-10 00:04:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '5c3dc505331c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add sequence column to firewall_rules table."""
    op.add_column('firewall_rules', sa.Column('sequence', sa.Integer(), nullable=True))
    op.create_index('ix_firewall_rules_sequence', 'firewall_rules', ['sequence'])


def downgrade() -> None:
    """Remove sequence column from firewall_rules table."""
    op.drop_index('ix_firewall_rules_sequence', table_name='firewall_rules')
    op.drop_column('firewall_rules', 'sequence')
