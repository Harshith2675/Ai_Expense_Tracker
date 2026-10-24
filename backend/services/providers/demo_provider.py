"""
services/providers/demo_provider.py — Mock / Demo financial data provider.
Provides deterministic, clearly-labelled sample transactions for testing
and evaluation without contacting any third-party financial services.
"""
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from services.providers.base import BaseBankingProvider, NormalizedTransaction


class DemoBankingProvider(BaseBankingProvider):
    """Demo banking provider generating simulated, clearly marked test transactions."""

    @property
    def provider_id(self) -> str:
        return "demo_bank"

    @property
    def display_name(self) -> str:
        return "Demo Sandbox Provider (Simulated)"

    def is_configured(self) -> bool:
        # Demo mode is always available out-of-the-box
        return True

    def get_status(self) -> dict:
        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "is_configured": True,
            "is_demo": True,
            "mode": "demo",
            "connection_status": "demo_active",
            "message": "Running in safe demonstration mode with simulated financial feed.",
        }

    def fetch_transactions(self, since: Optional[datetime] = None) -> List[NormalizedTransaction]:
        """
        Returns a deterministic set of realistic simulated transactions with stable external IDs.
        Includes a mix of income, routine expenses, an ambiguous transaction needing review,
        and a handled refund to ensure comprehensive flow testing.
        """
        now = datetime.now(timezone.utc)
        d_today = now.strftime("%Y-%m-%d")
        d_yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        d_2days = (now - timedelta(days=2)).strftime("%Y-%m-%d")
        d_3days = (now - timedelta(days=3)).strftime("%Y-%m-%d")
        d_5days = (now - timedelta(days=5)).strftime("%Y-%m-%d")
        d_7days = (now - timedelta(days=7)).strftime("%Y-%m-%d")

        raw_feed = [
            # 1. Salary Direct Deposit (Clear Income)
            NormalizedTransaction(
                external_id="DEMO_TXN_001",
                description="Acme Corp Payroll Direct Deposit",
                amount=3450.00,
                transaction_type="income",
                transaction_date=d_7days,
                payment_method="Bank Transfer",
                suggested_category="Salary",
                confidence=0.99,
                requires_review=False,
                is_reversed=False,
                is_pending=False,
                raw_category="Payroll / Wages",
                notes="Bi-weekly salary direct deposit (Simulated Demo)",
                is_demo=True,
            ),
            # 2. Grocery Store (Clear Expense)
            NormalizedTransaction(
                external_id="DEMO_TXN_002",
                description="Whole Foods Market Store #104",
                amount=87.65,
                transaction_type="expense",
                transaction_date=d_5days,
                payment_method="Debit Card",
                suggested_category="Groceries",
                confidence=0.96,
                requires_review=False,
                is_reversed=False,
                is_pending=False,
                raw_category="Supermarkets / Groceries",
                notes="Organic produce & household items (Simulated Demo)",
                is_demo=True,
            ),
            # 3. Ride Sharing / Transit (Clear Expense)
            NormalizedTransaction(
                external_id="DEMO_TXN_003",
                description="Uber Technologies Inc - Ride",
                amount=24.50,
                transaction_type="expense",
                transaction_date=d_3days,
                payment_method="Credit Card",
                suggested_category="Transportation",
                confidence=0.95,
                requires_review=False,
                is_reversed=False,
                is_pending=False,
                raw_category="Taxi & Ground Transport",
                notes="City transit ride (Simulated Demo)",
                is_demo=True,
            ),
            # 4. Electric Utility Bill (Clear Expense)
            NormalizedTransaction(
                external_id="DEMO_TXN_004",
                description="City Power & Light Electric Utility AutoPay",
                amount=115.30,
                transaction_type="expense",
                transaction_date=d_2days,
                payment_method="Bank Transfer",
                suggested_category="Bills",
                confidence=0.94,
                requires_review=False,
                is_reversed=False,
                is_pending=False,
                raw_category="Utilities / Electric",
                notes="Monthly residential power bill (Simulated Demo)",
                is_demo=True,
            ),
            # 5. Ambiguous merchant — flagged for user review
            NormalizedTransaction(
                external_id="DEMO_TXN_005",
                description="SQ *DOWNTOWN WORKSPACE #8201",
                amount=65.00,
                transaction_type="expense",
                transaction_date=d_yesterday,
                payment_method="Credit Card",
                suggested_category="Other",
                confidence=0.55,
                requires_review=True,  # Uncertain category: could be Education, Bills, or Other
                is_reversed=False,
                is_pending=False,
                raw_category="General Services",
                notes="Categorization ambiguous. Please confirm category before saving (Simulated Demo).",
                is_demo=True,
            ),
            # 6. Ambiguous P2P payment — flagged for user review
            NormalizedTransaction(
                external_id="DEMO_TXN_006",
                description="Venmo P2P Cashtag Transfer - Ref 9842",
                amount=45.00,
                transaction_type="expense",
                transaction_date=d_yesterday,
                payment_method="UPI",
                suggested_category="Other",
                confidence=0.50,
                requires_review=True,  # Could be Food, Entertainment, Gift, or Shopping
                is_reversed=False,
                is_pending=False,
                raw_category="Peer-to-Peer Transfer",
                notes="P2P transaction without merchant descriptor. Needs user verification (Simulated Demo).",
                is_demo=True,
            ),
            # 7. Handled Merchant Refund (Credit back to account, accurately categorized as income/offset)
            NormalizedTransaction(
                external_id="DEMO_TXN_007",
                description="Target Stores - Return Refund #4410",
                amount=39.99,
                transaction_type="income",
                transaction_date=d_today,
                payment_method="Credit Card",
                suggested_category="Shopping",
                confidence=0.88,
                requires_review=False,
                is_reversed=False,
                is_pending=False,
                raw_category="Refunds / Merchandise Return",
                notes="Returned merchandise credit adjustment (Simulated Demo)",
                is_demo=True,
            ),
        ]

        return raw_feed
