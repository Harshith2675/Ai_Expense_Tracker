"""
services/providers/plaid_provider.py — Adapter for Plaid Open Banking API.
Strictly checks environment variables for credentials and never exposes secrets.
If credentials or the Plaid SDK are not available, it cleanly reports not configured.
"""
import os
import logging
from typing import Optional, List, Any
from datetime import datetime, timezone
from services.providers.base import BaseBankingProvider, NormalizedTransaction

logger = logging.getLogger(__name__)


def _extract_field(obj: Any, field_name: str, default: Any = None) -> Any:
    """Helper to safely extract field values from either dicts or SDK typed model objects."""
    if isinstance(obj, dict):
        val = obj.get(field_name, default)
    else:
        val = getattr(obj, field_name, default)
    return default if val is None else val


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

    @staticmethod
    def is_sdk_available() -> bool:
        """Check if the plaid-python library is installed in the active environment."""
        try:
            import plaid  # noqa: F401
            return True
        except ImportError:
            return False

    def is_configured(self) -> bool:
        """
        Returns True ONLY if official credentials, access token,
        AND the Plaid SDK library are all present and importable.
        """
        has_credentials = bool(self.client_id and self.secret and self.access_token)
        return has_credentials and self.is_sdk_available()

    def get_status(self) -> dict:
        sdk_present = self.is_sdk_available()
        has_credentials = bool(self.client_id and self.secret and self.access_token)
        configured = has_credentials and sdk_present

        if has_credentials and not sdk_present:
            message = "Plaid credentials configured in .env, but 'plaid-python' library is not installed in the environment."
        elif configured:
            message = f"Plaid integration configured and active in {self.environment} environment."
        else:
            message = "Plaid integration not configured. Requires PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ACCESS_TOKEN in .env."

        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "is_configured": configured,
            "is_demo": False,
            "mode": "real" if configured else "unconfigured",
            "connection_status": "connected" if configured else "disconnected",
            "environment": self.environment if configured else None,
            "sdk_installed": sdk_present,
            "message": message,
        }

    def fetch_transactions(self, since: Optional[datetime] = None) -> List[NormalizedTransaction]:
        """
        Fetch external transactions from Plaid API.
        Only executes if fully configured and official SDK is present.
        """
        if not self.is_configured():
            logger.warning("[PlaidProvider] Attempted to fetch transactions when unconfigured or SDK missing.")
            return []

        try:
            import plaid
            from plaid.api import plaid_api
            from plaid.model.transactions_sync_request import TransactionsSyncRequest

            if self.environment == "production":
                host = plaid.Environment.Production
            elif self.environment == "development":
                host = getattr(plaid.Environment, "Development", plaid.Environment.Sandbox)
            else:
                host = plaid.Environment.Sandbox

            configuration = plaid.Configuration(
                host=host,
                api_key={
                    "clientId": self.client_id,
                    "secret": self.secret,
                }
            )
            api_client = plaid.ApiClient(configuration)
            client = plaid_api.PlaidApi(api_client)

            request = TransactionsSyncRequest(access_token=self.access_token)
            response = client.transactions_sync(request)

            # Support both SDK model objects and dict responses
            if hasattr(response, "added"):
                added_txs = response.added or []
            elif isinstance(response, dict):
                added_txs = response.get("added", response.get("transactions", []))
            else:
                added_txs = getattr(response, "added", []) or []

            normalized: List[NormalizedTransaction] = []
            for tx in added_txs:
                # Plaid amounts: positive = expense/debit, negative = income/credit
                raw_amt = float(_extract_field(tx, "amount", 0.0))
                is_income = raw_amt < 0
                abs_amount = abs(raw_amt)

                description = (
                    _extract_field(tx, "name")
                    or _extract_field(tx, "merchant_name")
                    or "Card Transaction"
                )

                raw_cat_val = _extract_field(tx, "category")
                if isinstance(raw_cat_val, (list, tuple)) and len(raw_cat_val) > 0:
                    raw_cat = str(raw_cat_val[0])
                elif raw_cat_val:
                    raw_cat = str(raw_cat_val)
                else:
                    raw_cat = "Other"

                suggested_cat = self._map_category(raw_cat, description)
                confidence = 0.90 if suggested_cat != "Other" else 0.50

                tx_id = str(_extract_field(tx, "transaction_id", ""))
                tx_date_val = _extract_field(tx, "date")
                tx_date = str(tx_date_val) if tx_date_val else datetime.now(timezone.utc).strftime("%Y-%m-%d")

                payment_channel = str(_extract_field(tx, "payment_channel", "")).lower()
                payment_method = "Debit Card" if payment_channel in ("in store", "in_store") else "Bank Transfer"
                is_pending = bool(_extract_field(tx, "pending", False))

                normalized.append(NormalizedTransaction(
                    external_id=tx_id,
                    description=description,
                    amount=abs_amount,
                    transaction_type="income" if is_income else "expense",
                    transaction_date=tx_date,
                    payment_method=payment_method,
                    suggested_category=suggested_cat,
                    confidence=confidence,
                    requires_review=confidence < 0.75,
                    is_reversed=False,
                    is_pending=is_pending,
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
