import unittest
from app import create_app

class ExpenseTrackerApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("status"), "healthy")

    def test_summary_endpoint(self):
        response = self.client.get("/api/summary")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("total_income", data)
        self.assertIn("total_expenses", data)

    def test_predict_category_endpoint(self):
        response = self.client.post("/api/ai/predict-category", json={"description": "Uber ride downtown"})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("category"), "Transportation")

if __name__ == "__main__":
    unittest.main()
