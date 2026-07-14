import os
import unittest
from database import SessionLocal, init_db, HCP, Material, Sample
from agent import run_mock_extraction

class TestCRMModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Initialize database
        init_db()

    def test_database_records(self):
        db = SessionLocal()
        try:
            # Query HCPs
            hcps = db.query(HCP).all()
            self.assertGreater(len(hcps), 0)
            hcp_names = [h.name for h in hcps]
            self.assertIn("Dr. Sharma", hcp_names)
            
            # Query Materials
            mats = db.query(Material).all()
            self.assertGreater(len(mats), 0)
            mat_names = [m.name for m in mats]
            self.assertIn("OncoBoost Phase III PDF", mat_names)
            
            # Query Samples
            samps = db.query(Sample).all()
            self.assertGreater(len(samps), 0)
            samp_names = [s.name for s in samps]
            self.assertIn("OncoBoost 10mg Starter Pack", samp_names)
        finally:
            db.close()

    def test_mock_extraction_parsing(self):
        log_text = (
            "Met Dr. Sharma today. Discussed the efficacy of OncoBoost. "
            "Sentiment was positive. Shared the brochure, and gave 2 samples of OncoBoost. "
            "We agreed to follow up in 2 weeks."
        )
        
        initial_fields = {
            "hcp_name": "",
            "hcp_id": None,
            "type": "Meeting",
            "date": "",
            "time": "",
            "attendees": "",
            "topics_discussed": "",
            "materials": [],
            "samples": [],
            "sentiment": "Neutral",
            "outcomes": "",
            "follow_up_actions": ""
        }
        
        extracted = run_mock_extraction(log_text, initial_fields)
        
        # Verify extraction
        self.assertEqual(extracted["hcp_name"], "Dr. Sharma")
        self.assertEqual(extracted["interaction_type"], "Meeting")
        self.assertEqual(extracted["sentiment"], "Positive")
        
        # Verify materials matched (from DB)
        self.assertIn("OncoBoost Phase III PDF", extracted["materials"])
        
        # Verify samples matched (from DB)
        self.assertIn("OncoBoost 10mg Starter Pack", extracted["samples"])
        
        # Verify topics discussed
        self.assertTrue(len(extracted["topics_discussed"]) > 0)
        self.assertIn("efficacy", extracted["topics_discussed"].lower())

if __name__ == "__main__":
    unittest.main()
