"""
services/providers/factory.py — Provider factory for financial integrations.
Resolves provider instances based on system configuration and environment variables.
"""
import os
from typing import Optional, List, Dict, Any
from services.providers.base import BaseBankingProvider
from services.providers.demo_provider import DemoBankingProvider
from services.providers.plaid_provider import PlaidBankingProvider


class DisconnectedBankingProvider(BaseBankingProvider):
    """Stub provider representing disconnected state."""

    @property
    def provider_id(self) -> str:
        return "disconnected"

    @property
    def display_name(self) -> str:
        return "Disconnected"

    def is_configured(self) -> bool:
        return False

    def get_status(self) -> dict:
        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "is_configured": False,
            "is_demo": False,
            "mode": "disconnected",
            "connection_status": "disconnected",
            "message": "Automatic transaction detection is currently disconnected.",
        }

    def fetch_transactions(self, since=None):
        return []


def get_banking_provider(override_mode: Optional[str] = None) -> BaseBankingProvider:
    """
    Resolve the active banking provider.
    Priority:
    1. override_mode if passed ('demo', 'plaid', 'disconnected')
    2. BANKING_PROVIDER environment variable
    3. If PLAID is configured in env -> PlaidBankingProvider
    4. Default -> DemoBankingProvider (safe out-of-the-box experience)
    """
    mode = (override_mode or os.getenv("BANKING_PROVIDER", "demo")).strip().lower()

    if mode == "disconnected":
        return DisconnectedBankingProvider()

    if mode in ("plaid", "real"):
        plaid_adapter = PlaidBankingProvider()
        if plaid_adapter.is_configured():
            return plaid_adapter
        # If Plaid requested but not configured, return Plaid adapter so its get_status() explains requirements
        if override_mode in ("plaid", "real"):
            return plaid_adapter
        # Otherwise fall back safely to demo
        return DemoBankingProvider()

    # Default to Demo provider
    return DemoBankingProvider()


def list_supported_providers() -> List[Dict[str, Any]]:
    """List all supported providers with their availability status."""
    plaid_adapter = PlaidBankingProvider()
    return [
        {
            "id": "demo",
            "name": "Demo Sandbox Mode",
            "type": "mock",
            "is_configured": True,
            "is_demo": True,
            "description": "Safe simulated bank feed with deterministic transactions for testing.",
        },
        {
            "id": "plaid",
            "name": "Plaid Open Banking",
            "type": "real",
            "is_configured": plaid_adapter.is_configured(),
            "is_demo": False,
            "description": "Official Open Banking API connection via OAuth 2.0 (requires credentials).",
        },
        {
            "id": "disconnected",
            "name": "Disconnected",
            "type": "none",
            "is_configured": True,
            "is_demo": False,
            "description": "No provider connected; automatic sync disabled.",
        },
    ]
