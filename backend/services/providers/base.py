"""
services/providers/base.py — Base interface and data models for banking/financial providers.
All banking adapters must inherit from BaseBankingProvider and return NormalizedTransaction objects.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime


@dataclass
class NormalizedTransaction:
    """Normalized banking transaction structure independent of specific provider APIs."""
    external_id: str
    description: str
    amount: float
    transaction_type: str  # 'expense' | 'income'
    transaction_date: str  # YYYY-MM-DD
    payment_method: str    # 'Debit Card' | 'Credit Card' | 'Bank Transfer' | 'UPI' | 'Other'
    suggested_category: str
    confidence: float      # 0.0 to 1.0
    requires_review: bool
    is_reversed: bool = False
    is_pending: bool = False
    raw_category: Optional[str] = None
    notes: Optional[str] = None
    is_demo: bool = False


class BaseBankingProvider(ABC):
    """Abstract base class for financial provider integrations."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Machine identifier (e.g. 'demo_bank', 'plaid')."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human readable name for UI."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if all required credentials / environment variables are set."""
        pass

    @abstractmethod
    def get_status(self) -> dict:
        """Return connectivity status, configuration details, and provider mode."""
        pass

    @abstractmethod
    def fetch_transactions(self, since: Optional[datetime] = None) -> List[NormalizedTransaction]:
        """
        Fetch external transactions and normalize them into NormalizedTransaction items.
        Must be idempotent and not side-effecting.
        """
        pass
