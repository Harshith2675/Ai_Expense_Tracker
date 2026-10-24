"""
services/providers/plaid_provider.py — Adapter for Plaid Open Banking API.
Strictly checks environment variables for credentials and never exposes secrets.
If credentials or the Plaid SDK are not available, it cleanly reports not configured.
"""
import os
import logging
from typing import Optional, List
from datetime import datetime
from services.providers.base import BaseBankingProvider, NormalizedTransaction

logger = logging.getLogger(__name__)


class PlaidBankingProvider(BaseBankingProvider):
    """Adapter for authorized Open Banking API integration via Plaid."""

    def __init__(self):
        self.client_id = os.getenv("PLAID_CLIENT_ID", "").strip()
        self.secret = os.getenv("PLAID_SECRET", "").strip()
        self.access_token = os.getenv("PLAID_ACCESS_TOKEN", "").strip()
        self.environment = os.getenv("PLAID_ENV", "sandbox").strip().lower()

    @property
    def provider_id(self) -> str:
        return "plaid"

    @property
    def display_name(self) -> str:
        return "Plaid Open Banking (Official API)"

    def is_configured(self) -> bool:
        """Returns True ONLY if official credentials and access token are present in env."""
        return bool(self.client_id and self.secret and self.access_token)

    def get_status(self) -> dict:
        configured = self.is_configured()
        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "is_configured": configured,
            "is_demo": False,
            "mode": "real" if configured else "unconfigured",
            "connection_status": "connected" if configured else "disconnected",
            "environment": self.environment if configured else None,
            "message": (
                "Plaid credentials configured in environment."
                if configured else
                "Plaid integration not configured. Requires PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ACCESS_TOKEN in .env."
            ),
        }

    def fetch_transactions(self, since: Optional[datetime] = None) -> List[NormalizedTransaction]:
        """
        Fetch external transactions from Plaid API.
        Only executes if fully configured and official SDK is present.
        """
        if not self.is_configured():
            logger.warning("[PlaidProvider] Attempted to fetch transactions when unconfigured.")
            return []

        try:
            import plaid
            from plaid.api import plaid_api
            from plaid.model.transactions_sync_request import TransactionsSyncRequest

            configuration = plaid.Configuration(
                host=(
                    plaid.Environment.Production if self.environment == "production"
                    else plaid.Environment.Development if self.environment == "development"
                    else plaid.Environment.Sandbox
                ),
                api_key={
                    "clientId": self.client_id,
                    "secret": self.secret,
                }
            )
            api_client = plaid.ApiClient(configuration)
            client = plaid_api.PlaidApi(api_client)

            request = TransactionsSyncRequest(access_token=self.access_token)
            response = client.transactions_sync(request)
            added_txs = response.get("added", [])

            normalized: List[NormalizedTransaction] = []
            for tx in added_txs:
                # Plaid amounts: positive = expense/debit, negative = income/credit
                raw_amt = float(tx.get("amount", 0.0))
                is_income = raw_amt < 0
                abs_amount = abs(raw_amt)
                description = tx.get("name") or tx.get("merchant_name") or "Card Transaction"
                raw_cat = tx.get("category", ["Other"])[0] if tx.get("category") else "Other"

                suggested_cat = self._map_category(raw_cat, description)
                confidence = 0.90 if suggested_cat != "Other" else 0.50

                normalized.append(NormalizedTransaction(
                    external_id=str(tx.get("transaction_id")),
                    description=description,
                    amount=abs_amount,
                    transaction_type="income" if is_income else "expense",
                    transaction_date=tx.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
                    payment_method="Debit Card" if tx.get("payment_channel") == "in store" else "Bank Transfer",
                    suggested_category=suggested_cat,
                    confidence=confidence,
                    requires_review=confidence < 0.75,
                    is_reversed=False,
                    is_pending=bool(tx.get("pending")),
                    raw_category=raw_cat,
                    notes=f"Synced via Plaid ({self.environment})",
                    is_demo=False,
                ))

            return normalized
        except ImportError:
            logger.error("[PlaidProvider] plaid-python library is not installed in the environment.")
            raise RuntimeError("Plaid SDK is not installed on this system. Please check requirements.")
        except Exception as e:
            logger.error(f"[PlaidProvider] API error fetching transactions: {e}")
            raise RuntimeError(f"Plaid provider error: {str(e)}")

    def _map_category(self, raw_category: str, description: str) -> str:
        """Map raw provider category to AI Expense Tracker categories."""
        c = (raw_category + " " + description).lower()
        if any(w in c for w in ["food", "restaurant", "cafe", "dining", "meal", "coffee"]):
            return "Food"
        if any(w in c for w in ["grocery", "supermarket", "whole foods", "trader joe", "kroger"]):
            return "Groceries"
        if any(w in c for w in ["uber", "lyft", "transit", "taxi", "gas", "fuel", "metro", "subway"]):
            return "Transportation"
        if any(w in c for w in ["amazon", "clothing", "shopping", "retail", "store"]):
            return "Shopping"
        if any(w in c for w in ["electric", "water", "utility", "bill", "power", "internet", "telecom"]):
            return "Bills"
        if any(w in c for w in ["payroll", "salary", "wage", "direct deposit"]):
            return "Salary"
        if any(w in c for w in ["rent", "lease", "housing"]):
            return "Rent"
        if any(w in c for w in ["hospital", "doctor", "health", "pharmacy", "clinic", "dental"]):
            return "Healthcare"
        if any(w in c for w in ["cinema", "movie", "entertainment", "game", "streaming"]):
            return "Entertainment"
        return "Other"
