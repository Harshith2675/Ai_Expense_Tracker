"""
AI & ML Module for Expense Tracker
Prepared for future Scikit-learn and Pandas integrations:
- Expense categorization prediction (TF-IDF + Naive Bayes / Random Forest)
- Spending anomaly detection (Isolation Forest)
- Budget forecasting (Linear Regression / Exponential Smoothing)
"""

try:
    import pandas as pd
    import numpy as np
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

class ExpenseAIAnalytics:
    """Service stub for future AI analytics using Pandas and Scikit-learn."""
    
    def __init__(self):
        self.model = None
        self.vectorizer = None
        
    def prepare_dataset(self, transactions):
        """Converts transaction records into a Pandas DataFrame."""
        if not HAS_PANDAS:
            return transactions
        return pd.DataFrame(transactions)
    
    def predict_category(self, description: str):
        """
        Predicts category for a given transaction description.
        Future implementation will use trained Scikit-learn classifier.
        """
        # Rule-based fallback heuristic until ML model weights are trained
        desc = description.lower()
        if any(w in desc for w in ["uber", "lyft", "fuel", "gas", "flight", "subway", "transit"]):
            return {"category": "Transportation", "confidence": 0.92, "model": "heuristic-preview"}
        if any(w in desc for w in ["market", "grocery", "coffee", "starbucks", "restaurant", "dining"]):
            return {"category": "Food & Dining", "confidence": 0.88, "model": "heuristic-preview"}
        if any(w in desc for w in ["netflix", "spotify", "gym", "cinema", "prime"]):
            return {"category": "Entertainment", "confidence": 0.85, "model": "heuristic-preview"}
        if any(w in desc for w in ["amazon", "apple", "target", "walmart", "clothing"]):
            return {"category": "Shopping", "confidence": 0.80, "model": "heuristic-preview"}
        if any(w in desc for w in ["electric", "water", "wifi", "internet", "rent"]):
            return {"category": "Bills & Utilities", "confidence": 0.95, "model": "heuristic-preview"}
        return {"category": "General", "confidence": 0.50, "model": "heuristic-preview"}

    def detect_anomalies(self, transactions_df):
        """
        Anomaly detection pipeline stub using IsolationForest from Scikit-learn.
        Flags transactions that deviate abnormally from 30-day rolling baseline.
        """
        return []
