"""
services/providers package — Provider architecture for banking / open-banking integrations.
"""
from services.providers.base import BaseBankingProvider, NormalizedTransaction
from services.providers.demo_provider import DemoBankingProvider
from services.providers.plaid_provider import PlaidBankingProvider
from services.providers.factory import get_banking_provider, list_supported_providers

__all__ = [
    "BaseBankingProvider",
    "NormalizedTransaction",
    "DemoBankingProvider",
    "PlaidBankingProvider",
    "get_banking_provider",
    "list_supported_providers",
]
