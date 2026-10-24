"""
services/insights_service.py — AI & Statistical Insights Module for AI Expense Tracker.
Uses real SQLite transaction and budget data with Pandas and statistical baselines to generate
explainable spending analysis, trend tracking, anomaly alerts, and actionable saving recommendations.
"""
import calendar
from datetime import datetime, date, timezone
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np

from database.db import get_db_connection, cents_to_dollars, dollars_to_cents, row_to_dict
from api.transactions import EXPENSE_CATEGORIES

DISCRETIONARY_CATEGORIES = {
    "Entertainment",
    "Food & Dining",
    "Dining Out",
    "Shopping",
    "Personal",
    "Travel",
    "Other"
}


class InsightsService:
    def __init__(self, db_path: str):
        self.db_path = db_path

    # ---------------------------------------------------------------------------
    # 1. Summary Insights
    # ---------------------------------------------------------------------------
    def get_summary(self, month: int, year: int, currency: str = "USD") -> Dict[str, Any]:
        """
        Generate aggregate financial insights for the selected month:
        - Total expenses
        - MoM comparison with previous month (dollar/rupee variance & percentage change)
        - Average daily spending
        - Highest-spending category and share
        - Budget health overview
        """
        sym = "₹" if (currency or "").upper() == "INR" else "$"

        # Validate month/year
        if not (1 <= month <= 12):
            raise ValueError("Month must be between 1 and 12.")
        if not (2000 <= year <= 2100):
            raise ValueError("Year must be between 2000 and 2100.")

        # Determine previous month
        if month == 1:
            prev_month = 12
            prev_year = year - 1
        else:
            prev_month = month - 1
            prev_year = year

        with get_db_connection(self.db_path) as conn:
            # Current month expenses
            curr_row = conn.execute(
                """
                SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
                       COUNT(id) AS txn_count
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND strftime('%Y', transaction_date) = ?
                  AND CAST(strftime('%m', transaction_date) AS INTEGER) = ?
                """,
                (str(year), month)
            ).fetchone()

            # Previous month expenses
            prev_row = conn.execute(
                """
                SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
                       COUNT(id) AS txn_count
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND strftime('%Y', transaction_date) = ?
                  AND CAST(strftime('%m', transaction_date) AS INTEGER) = ?
                """,
                (str(prev_year), prev_month)
            ).fetchone()

            # Category spending for current month
            cat_rows = conn.execute(
                """
                SELECT category, SUM(amount_cents) AS spent_cents, COUNT(id) AS txn_count
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND strftime('%Y', transaction_date) = ?
                  AND CAST(strftime('%m', transaction_date) AS INTEGER) = ?
                GROUP BY category
                ORDER BY spent_cents DESC
                """,
                (str(year), month)
            ).fetchall()

            # Current month budget totals
            budget_rows = conn.execute(
                """
                SELECT COALESCE(SUM(amount_cents), 0) AS total_budget_cents
                FROM budgets
                WHERE budget_year = ? AND budget_month = ?
                """,
                (year, month)
            ).fetchone()

        curr_total = cents_to_dollars(curr_row["total_cents"])
        curr_count = curr_row["txn_count"]
        prev_total = cents_to_dollars(prev_row["total_cents"])
        prev_count = prev_row["txn_count"]

        # Month-over-Month calculation
        mom_diff = round(curr_total - prev_total, 2)
        if prev_total > 0:
            mom_pct = round(((curr_total - prev_total) / prev_total) * 100, 1)
            mom_status = "increased" if mom_diff > 0 else ("decreased" if mom_diff < 0 else "unchanged")
            mom_explanation = f"{abs(mom_pct):.1f}% {'higher' if mom_diff > 0 else 'lower'} than {calendar.month_abbr[prev_month]} {prev_year}"
        elif curr_total > 0:
            mom_pct = None
            mom_status = "new_baseline"
            mom_explanation = f"First month with recorded expenses ({sym}{curr_total:.2f}); no spending in prior month."
        else:
            mom_pct = 0.0
            mom_status = "zero"
            mom_explanation = "No expenses recorded for both current and prior months."

        # Average Daily Spending calculation
        today = date.today()
        days_in_month = calendar.monthrange(year, month)[1]
        if today.year == year and today.month == month:
            elapsed_days = max(1, today.day)
        else:
            elapsed_days = days_in_month

        avg_daily = round(curr_total / elapsed_days, 2)

        # Highest-spending category
        if cat_rows:
            top_cat = cat_rows[0]["category"]
            top_cat_spent = cents_to_dollars(cat_rows[0]["spent_cents"])
            top_cat_pct = round((top_cat_spent / curr_total * 100), 1) if curr_total > 0 else 0.0
            highest_category = {
                "category": top_cat,
                "amount": top_cat_spent,
                "percentage": top_cat_pct,
                "transaction_count": cat_rows[0]["txn_count"]
            }
        else:
            highest_category = None

        # Budget comparison
        total_budget = cents_to_dollars(budget_rows["total_budget_cents"])
        if total_budget > 0:
            budget_used_pct = round((curr_total / total_budget * 100), 1)
            budget_remaining = round(total_budget - curr_total, 2)
            if curr_total > total_budget:
                budget_status = "exceeded"
            elif budget_used_pct >= 85.0:
                budget_status = "warning"
            else:
                budget_status = "on_track"
        else:
            budget_used_pct = 0.0
            budget_remaining = 0.0
            budget_status = "unbudgeted"

        return {
            "month": month,
            "year": year,
            "month_name": f"{calendar.month_name[month]} {year}",
            "total_expenses": curr_total,
            "transaction_count": curr_count,
            "previous_month": {
                "month": prev_month,
                "year": prev_year,
                "month_name": f"{calendar.month_name[prev_month]} {prev_year}",
                "total_expenses": prev_total,
                "transaction_count": prev_count,
            },
            "comparison": {
                "difference": mom_diff,
                "percentage": mom_pct,
                "status": mom_status,
                "explanation": mom_explanation,
                "is_increase": mom_diff > 0
            },
            "daily_spending": {
                "average_per_day": avg_daily,
                "days_considered": elapsed_days,
                "total_days_in_month": days_in_month
            },
            "highest_category": highest_category,
            "budget": {
                "total_budget": total_budget,
                "used_percentage": budget_used_pct,
                "remaining": budget_remaining,
                "status": budget_status
            },
            "has_sufficient_history": (curr_count >= 3 or prev_count >= 3)
        }

    # ---------------------------------------------------------------------------
    # 2. Category Analysis
    # ---------------------------------------------------------------------------
    def get_categories(self, month: int, year: int) -> List[Dict[str, Any]]:
        """
        Return category-wise spending totals, percentage shares, MoM changes,
        and budget utilization for the selected month.
        """
        if month == 1:
            prev_month = 12
            prev_year = year - 1
        else:
            prev_month = month - 1
            prev_year = year

        with get_db_connection(self.db_path) as conn:
            curr_rows = conn.execute(
                """
                SELECT category, SUM(amount_cents) AS spent_cents, COUNT(id) AS count
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND strftime('%Y', transaction_date) = ?
                  AND CAST(strftime('%m', transaction_date) AS INTEGER) = ?
                GROUP BY category
                ORDER BY spent_cents DESC
                """,
                (str(year), month)
            ).fetchall()

            prev_rows = conn.execute(
                """
                SELECT category, SUM(amount_cents) AS spent_cents
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND strftime('%Y', transaction_date) = ?
                  AND CAST(strftime('%m', transaction_date) AS INTEGER) = ?
                GROUP BY category
                """,
                (str(prev_year), prev_month)
            ).fetchall()

            budget_rows = conn.execute(
                """
                SELECT category, amount_cents
                FROM budgets
                WHERE budget_year = ? AND budget_month = ?
                """,
                (year, month)
            ).fetchall()

        total_spent_cents = sum(r["spent_cents"] for r in curr_rows)
        prev_map = {r["category"]: r["spent_cents"] for r in prev_rows}
        budget_map = {r["category"]: r["amount_cents"] for r in budget_rows}

        results = []
        for r in curr_rows:
            cat = r["category"]
            cents = r["spent_cents"]
            amount = cents_to_dollars(cents)
            pct_of_total = round((cents / total_spent_cents * 100), 1) if total_spent_cents > 0 else 0.0

            prev_cents = prev_map.get(cat, 0)
            prev_amount = cents_to_dollars(prev_cents)
            diff = round(amount - prev_amount, 2)

            if prev_amount > 0:
                pct_change = round(((amount - prev_amount) / prev_amount) * 100, 1)
                trend = "increasing" if diff > 0 else ("decreasing" if diff < 0 else "stable")
            elif amount > 0:
                pct_change = None
                trend = "new"
            else:
                pct_change = 0.0
                trend = "stable"

            # Budget data
            budget_cents = budget_map.get(cat)
            if budget_cents:
                budget_amount = cents_to_dollars(budget_cents)
                budget_pct = round((amount / budget_amount * 100), 1)
            else:
                budget_amount = None
                budget_pct = None

            results.append({
                "category": cat,
                "amount": amount,
                "percentage": pct_of_total,
                "transaction_count": r["count"],
                "previous_amount": prev_amount,
                "difference": diff,
                "percentage_change": pct_change,
                "trend": trend,
                "budget_limit": budget_amount,
                "budget_used_percentage": budget_pct,
                "is_discretionary": cat in DISCRETIONARY_CATEGORIES
            })

        return results

    # ---------------------------------------------------------------------------
    # 3. Trends Over Time (Pandas-powered rolling history)
    # ---------------------------------------------------------------------------
    def get_trends(
        self,
        months: int = 6,
        end_month: Optional[int] = None,
        end_year: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Analyze multi-month spending trends, daily patterns, and persistent growth categories.
        """
        if months < 2:
            months = 6
        if months > 24:
            months = 24

        today = date.today()
        ref_month = end_month if end_month else today.month
        ref_year = end_year if end_year else today.year

        # Build list of year-month keys in chronological order
        period_keys = []
        cur_y = ref_year
        cur_m = ref_month
        for _ in range(months):
            period_keys.append((cur_y, cur_m))
            cur_m -= 1
            if cur_m == 0:
                cur_m = 12
                cur_y -= 1
        period_keys.reverse()

        earliest_y, earliest_m = period_keys[0]
        start_date = f"{earliest_y:04d}-{earliest_m:02d}-01"
        latest_y, latest_m = period_keys[-1]
        last_day = calendar.monthrange(latest_y, latest_m)[1]
        end_date = f"{latest_y:04d}-{latest_m:02d}-{last_day:02d}"

        with get_db_connection(self.db_path) as conn:
            tx_rows = conn.execute(
                """
                SELECT id, transaction_type, category, amount_cents, transaction_date
                FROM transactions
                WHERE (review_status IS NULL OR review_status = 'approved')
                  AND transaction_date >= ? AND transaction_date <= ?
                ORDER BY transaction_date ASC
                """,
                (start_date, end_date)
            ).fetchall()

        if tx_rows:
            df = pd.DataFrame([row_to_dict(r) for r in tx_rows])
            df["amount"] = df["amount_cents"].apply(cents_to_dollars)
            df["year_month"] = df["transaction_date"].str.slice(0, 7)
        else:
            df = pd.DataFrame(columns=["id", "transaction_type", "category", "amount_cents", "transaction_date", "amount", "year_month"])

        monthly_trends = []
        for y, m in period_keys:
            ym_key = f"{y:04d}-{m:02d}"
            label = f"{calendar.month_abbr[m]} {y}"

            month_df = df[df["year_month"] == ym_key] if not df.empty else df
            exp_df = month_df[month_df["transaction_type"] == "expense"] if not month_df.empty else pd.DataFrame()
            inc_df = month_df[month_df["transaction_type"] == "income"] if not month_df.empty else pd.DataFrame()

            total_exp = round(float(exp_df["amount"].sum()), 2) if not exp_df.empty else 0.0
            total_inc = round(float(inc_df["amount"].sum()), 2) if not inc_df.empty else 0.0
            tx_count = len(exp_df)

            days_count = calendar.monthrange(y, m)[1]
            if today.year == y and today.month == m:
                days_count = max(1, today.day)
            daily_avg = round(total_exp / days_count, 2) if total_exp > 0 else 0.0

            # Top category in that month
            if not exp_df.empty:
                cat_grouped = exp_df.groupby("category")["amount"].sum()
                top_cat = cat_grouped.idxmax()
                top_cat_amount = round(float(cat_grouped.max()), 2)
            else:
                top_cat = None
                top_cat_amount = 0.0

            monthly_trends.append({
                "period": ym_key,
                "label": label,
                "year": y,
                "month": m,
                "expenses": total_exp,
                "income": total_inc,
                "net_savings": round(total_inc - total_exp, 2),
                "transaction_count": tx_count,
                "average_daily": daily_avg,
                "top_category": top_cat,
                "top_category_amount": top_cat_amount
            })

        # Multi-period Category Growth Analysis
        # Identify categories whose spending has increased in 2+ consecutive periods
        increasing_categories = []
        if not df.empty and len(period_keys) >= 2:
            exp_all = df[df["transaction_type"] == "expense"]
            if not exp_all.empty:
                pivot = exp_all.pivot_table(
                    index="category",
                    columns="year_month",
                    values="amount",
                    aggfunc="sum",
                    fill_value=0.0
                )
                recent_cols = [f"{y:04d}-{m:02d}" for y, m in period_keys[-3:]]
                available_cols = [c for c in recent_cols if c in pivot.columns]

                if len(available_cols) >= 2:
                    for cat_name, row_series in pivot.iterrows():
                        vals = [float(row_series[c]) for c in available_cols]
                        # Check strictly increasing with non-trivial spend
                        if all(vals[i] > vals[i - 1] for i in range(1, len(vals))) and vals[-1] > 20:
                            increasing_categories.append({
                                "category": str(cat_name),
                                "periods": available_cols,
                                "values": vals,
                                "latest_amount": vals[-1],
                                "initial_amount": vals[0],
                                "total_increase": round(vals[-1] - vals[0], 2)
                            })

        return {
            "months_analyzed": len(monthly_trends),
            "trends": monthly_trends,
            "increasing_categories": increasing_categories,
            "has_data": any(m["expenses"] > 0 for m in monthly_trends)
        }

    # ---------------------------------------------------------------------------
    # 4. Potentially Unusual Transaction Alerts (Explainable statistical rules)
    # ---------------------------------------------------------------------------
    def get_anomalies(self, month: int, year: int, currency: str = "USD") -> Dict[str, Any]:
        """
        Detect potentially unusual transactions for the specified month using
        transparent statistical baseline rules per category.
        Labels items clearly as 'potentially unusual', not confirmed fraud.
        Allows users to dismiss alerts.
        """
        sym = "₹" if (currency or "").upper() == "INR" else "$"
        with get_db_connection(self.db_path) as conn:
            # Query dismissed transaction IDs
            dismissed_rows = conn.execute(
                "SELECT transaction_id FROM dismissed_anomalies"
            ).fetchall()
            dismissed_set = {r["transaction_id"] for r in dismissed_rows}

            # Query all approved expense transactions for historical context (up to selected month)
            # We use up to 12 months of historical observations to compute a defensible baseline
            last_day = calendar.monthrange(year, month)[1]
            selected_end_date = f"{year:04d}-{month:02d}-{last_day:02d}"
            all_tx_rows = conn.execute(
                """
                SELECT id, category, description, payment_method, amount_cents, transaction_date
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND transaction_date <= ?
                ORDER BY transaction_date ASC
                """,
                (selected_end_date,)
            ).fetchall()

        if not all_tx_rows:
            return {
                "month": month,
                "year": year,
                "anomalies": [],
                "total_flagged": 0,
                "dismissed_count": len(dismissed_set),
                "insufficient_data_reasons": ["No historical transactions found in the database."]
            }

        df = pd.DataFrame([row_to_dict(r) for r in all_tx_rows])
        df["amount"] = df["amount_cents"].apply(cents_to_dollars)
        df["year"] = df["transaction_date"].str.slice(0, 4).astype(int)
        df["month"] = df["transaction_date"].str.slice(5, 7).astype(int)

        # Separate target month transactions
        target_txs = df[(df["year"] == year) & (df["month"] == month)]

        anomalies = []
        insufficient_data_reasons = []

        if target_txs.empty:
            return {
                "month": month,
                "year": year,
                "anomalies": [],
                "total_flagged": 0,
                "dismissed_count": len(dismissed_set),
                "insufficient_data_reasons": [f"No expenses found for {calendar.month_name[month]} {year}."]
            }

        # Analyze each category
        for cat in target_txs["category"].unique():
            cat_history = df[df["category"] == cat]
            history_count = len(cat_history)

            # Require enough historical observations (at least 3 records) to establish a baseline
            if history_count < 3:
                insufficient_data_reasons.append(
                    f"Category '{cat}' has insufficient historical transactions ({history_count}). At least 3 are required to establish an anomaly baseline."
                )
                continue

            amounts = cat_history["amount"].values
            mean_val = float(np.mean(amounts))
            std_val = float(np.std(amounts))
            median_val = float(np.median(amounts))

            # Inspect each transaction in target month
            target_cat_txs = target_txs[target_txs["category"] == cat]
            for _, tx in target_cat_txs.iterrows():
                tx_id = int(tx["id"])
                if tx_id in dismissed_set:
                    continue

                amt = float(tx["amount"])

                # Defensible baseline rule:
                # 1) If std > 0, amount > mean + 2.0 * std
                # 2) Or amount >= 2.5 * median and (amount - mean) >= 30.0 (prevents flagging trivial small differences)
                is_std_outlier = (std_val > 0 and amt > (mean_val + 2.0 * std_val))
                is_median_outlier = (amt >= 2.5 * median_val and (amt - mean_val) >= 30.0)

                if is_std_outlier or is_median_outlier:
                    ratio = round(amt / mean_val, 1) if mean_val > 0 else 0.0
                    severity = "high" if ratio >= 3.0 or amt >= 500 else "medium"

                    reason = (
                        f"Amount of {sym}{amt:.2f} is {ratio}x your typical {cat} spending "
                        f"(historical average: {sym}{mean_val:.2f}, median: {sym}{median_val:.2f})."
                    )

                    anomalies.append({
                        "id": tx_id,
                        "transaction_date": tx["transaction_date"],
                        "description": tx["description"],
                        "category": cat,
                        "amount": amt,
                        "payment_method": tx["payment_method"],
                        "severity": severity,
                        "ratio": ratio,
                        "baseline_average": round(mean_val, 2),
                        "baseline_median": round(median_val, 2),
                        "reason": reason,
                        "status": "potentially_unusual"
                    })

        # Sort anomalies by amount descending
        anomalies.sort(key=lambda x: x["amount"], reverse=True)

        return {
            "month": month,
            "year": year,
            "anomalies": anomalies,
            "total_flagged": len(anomalies),
            "dismissed_count": len(dismissed_set),
            "insufficient_data_reasons": insufficient_data_reasons
        }

    def dismiss_anomaly(self, transaction_id: int) -> Dict[str, Any]:
        """Record an anomaly as dismissed by the user."""
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        with get_db_connection(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO dismissed_anomalies (transaction_id, dismissed_at)
                VALUES (?, ?)
                """,
                (transaction_id, now_str)
            )
            conn.commit()

        return {
            "success": True,
            "transaction_id": transaction_id,
            "message": "Transaction alert has been dismissed."
        }

    # ---------------------------------------------------------------------------
    # 5. Personalized Saving Recommendations
    # ---------------------------------------------------------------------------
    def get_recommendations(self, month: int, year: int, currency: str = "USD") -> Dict[str, Any]:
        """
        Generate grounded, actionable saving recommendations based on actual calculations:
        - Dominant spending categories (> 30% share)
        - Surging categories (> 20% increase MoM)
        - Approaching or exceeded budgets
        - Realistic discretionary optimization (10-15% target)
        - Identified recurring candidates
        """
        sym = "₹" if (currency or "").upper() == "INR" else "$"
        summary = self.get_summary(month, year, currency=currency)
        categories = self.get_categories(month, year)

        with get_db_connection(self.db_path) as conn:
            # Fetch budget records for this month
            budget_rows = conn.execute(
                """
                SELECT category, amount_cents
                FROM budgets
                WHERE budget_year = ? AND budget_month = ?
                """,
                (year, month)
            ).fetchall()

        budget_map = {r["category"]: cents_to_dollars(r["amount_cents"]) for r in budget_rows}

        recommendations = []
        total_exp = summary["total_expenses"]
        is_preliminary = summary["transaction_count"] < 5

        # 1. Budget Overruns and Warnings
        for cat_info in categories:
            cat_name = cat_info["category"]
            spent = cat_info["amount"]
            budget_limit = budget_map.get(cat_name)

            if budget_limit and budget_limit > 0:
                over = round(spent - budget_limit, 2)
                pct = round(spent / budget_limit * 100, 1)

                if spent > budget_limit:
                    recommendations.append({
                        "id": f"budget_exceeded_{cat_name}",
                        "type": "budget_exceeded",
                        "badge": "Budget Exceeded",
                        "category": cat_name,
                        "title": f"Curb {cat_name} spending: {sym}{over:.2f} over limit",
                        "evidence": f"You have spent {sym}{spent:.2f} against a {sym}{budget_limit:.2f} monthly budget ({pct}% utilized).",
                        "action": f"Pause optional {cat_name} purchases for the remainder of {calendar.month_abbr[month]} to prevent deficit.",
                        "potential_savings": f"{sym}{over:.2f} (budget recovery)",
                        "confidence": "high",
                        "priority": 1
                    })
                elif pct >= 85.0:
                    cushion = round(budget_limit - spent, 2)
                    recommendations.append({
                        "id": f"budget_warning_{cat_name}",
                        "type": "budget_warning",
                        "badge": "Near Budget Limit",
                        "category": cat_name,
                        "title": f"{cat_name} at {pct}% of monthly allowance",
                        "evidence": f"Spent {sym}{spent:.2f} of {sym}{budget_limit:.2f} limit. Only {sym}{cushion:.2f} cushion remains.",
                        "action": f"Limit daily {cat_name} spend to under {sym}{max(1.0, round(cushion / max(1, 30 - date.today().day), 2)):.2f}/day.",
                        "potential_savings": f"Save {sym}{cushion:.2f} by staying strictly within limit",
                        "confidence": "high",
                        "priority": 2
                    })

        # 2. Dominant Category Optimization
        if summary.get("highest_category") and total_exp > 0:
            top_cat = summary["highest_category"]["category"]
            top_amt = summary["highest_category"]["amount"]
            top_pct = summary["highest_category"]["percentage"]

            if top_pct >= 25.0 and top_amt >= 50.0:
                est_savings_10 = round(top_amt * 0.10, 2)
                est_annual = round(est_savings_10 * 12, 2)
                recommendations.append({
                    "id": f"top_category_{top_cat}",
                    "type": "dominant_category",
                    "badge": "Top Expense Share",
                    "category": top_cat,
                    "title": f"Optimize your largest expense: {top_cat} ({top_pct}% of total)",
                    "evidence": f"{top_cat} makes up {sym}{top_amt:.2f} ({top_pct}%) of all your {calendar.month_name[month]} expenses.",
                    "action": f"Plan purchases or switch to value alternatives in {top_cat} to target a 10% reduction.",
                    "potential_savings": f"~{sym}{est_savings_10:.2f}/mo (~{sym}{est_annual:.2f}/yr) based on 10% reduction",
                    "confidence": "high" if not is_preliminary else "preliminary",
                    "priority": 3
                })

        # 3. Surging Categories vs Previous Month
        for cat_info in categories:
            diff = cat_info["difference"]
            pct_chg = cat_info["percentage_change"]
            cat_name = cat_info["category"]

            if pct_chg is not None and pct_chg >= 25.0 and diff >= 25.0:
                recommendations.append({
                    "id": f"surge_{cat_name}",
                    "type": "spending_surge",
                    "badge": "Surge Alert",
                    "category": cat_name,
                    "title": f"{cat_name} rose +{pct_chg}% vs last month (+{sym}{diff:.2f})",
                    "evidence": f"Spending in {cat_name} reached {sym}{cat_info['amount']:.2f}, up from {sym}{cat_info['previous_amount']:.2f} in prior period.",
                    "action": f"Review recent transactions in {cat_name} to check if this was a one-time necessity or ongoing habit.",
                    "potential_savings": f"Up to {sym}{diff:.2f}/mo by resetting to prior month baseline",
                    "confidence": "high",
                    "priority": 4
                })

        # 4. Discretionary Spending Target (15% reduction)
        discretionary_total = sum(
            c["amount"] for c in categories if c["category"] in DISCRETIONARY_CATEGORIES
        )
        if discretionary_total >= 50.0:
            disc_savings = round(discretionary_total * 0.15, 2)
            disc_annual = round(disc_savings * 12, 2)
            recommendations.append({
                "id": "discretionary_trim",
                "type": "discretionary_trim",
                "badge": "Savings Opportunity",
                "category": "Discretionary",
                "title": "Discretionary Spending 15% Savings Target",
                "evidence": f"You spent {sym}{discretionary_total:.2f} across lifestyle and discretionary categories this month.",
                "action": "Cook at home more frequently and defer non-urgent shopping by 48 hours to prevent impulse buys.",
                "potential_savings": f"~{sym}{disc_savings:.2f}/mo (~{sym}{disc_annual:.2f}/yr) with a 15% trim",
                "confidence": "moderate" if not is_preliminary else "preliminary",
                "priority": 5
            })

        # 5. Recurring Subscriptions Audit
        recurring_candidates = self.get_recurring_candidates()
        if recurring_candidates:
            total_recurring = round(sum(r["amount"] for r in recurring_candidates), 2)
            recommendations.append({
                "id": "recurring_audit",
                "type": "recurring_audit",
                "badge": "Recurring Review",
                "category": "Subscriptions & Bills",
                "title": f"Review {len(recurring_candidates)} Recurring Expenses ({sym}{total_recurring:.2f}/mo)",
                "evidence": f"Detected recurring transactions like {recurring_candidates[0]['description']} ({sym}{recurring_candidates[0]['amount']:.2f}).",
                "action": "Audit recurring services to cancel any subscriptions you haven't actively used in the past 30 days.",
                "potential_savings": f"Up to {sym}{total_recurring:.2f}/mo depending on cancellations",
                "confidence": "high",
                "priority": 6
            })

        # Sort recommendations by priority
        recommendations.sort(key=lambda x: x["priority"])

        return {
            "month": month,
            "year": year,
            "recommendations": recommendations,
            "total_recommendations": len(recommendations),
            "is_preliminary": is_preliminary,
            "disclaimer": "All potential savings are estimated projections based on stated mathematical assumptions, not guaranteed outcomes."
        }

    # ---------------------------------------------------------------------------
    # 6. Recurring Expense Detection
    # ---------------------------------------------------------------------------
    def get_recurring_candidates(self) -> List[Dict[str, Any]]:
        """
        Identify recurring transactions by detecting repeated identical or near-identical
        amounts with matching descriptions across multiple dates.
        """
        with get_db_connection(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, description, category, amount_cents, transaction_date
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                ORDER BY transaction_date ASC
                """
            ).fetchall()

        if not rows or len(rows) < 2:
            return []

        df = pd.DataFrame([row_to_dict(r) for r in rows])
        df["amount"] = df["amount_cents"].apply(cents_to_dollars)
        df["clean_desc"] = df["description"].str.strip().str.title()
        df["year_month"] = df["transaction_date"].str.slice(0, 7)

        # Group by description and category
        candidates = []
        grouped = df.groupby(["clean_desc", "category"])
        for (desc, cat), group in grouped:
            if len(group) >= 2:
                # Check if transactions span across at least 2 distinct months
                distinct_months = group["year_month"].nunique()
                std_amt = group["amount"].std()

                # If amount variation is negligible (std < 2.0 or same amount)
                if distinct_months >= 2 and (pd.isna(std_amt) or std_amt < 2.0):
                    avg_amt = round(float(group["amount"].mean()), 2)
                    last_date = group["transaction_date"].max()
                    candidates.append({
                        "description": desc,
                        "category": cat,
                        "amount": avg_amt,
                        "occurrences": len(group),
                        "frequency": "Monthly",
                        "last_date": last_date
                    })

        # Sort by amount descending
        candidates.sort(key=lambda x: x["amount"], reverse=True)
        return candidates
