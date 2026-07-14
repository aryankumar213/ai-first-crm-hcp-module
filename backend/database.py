import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Date, Time, ForeignKey, Table
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = "sqlite:///./crm.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Many-to-many junction tables
interaction_materials = Table(
    "interaction_materials",
    Base.metadata,
    Column("interaction_id", Integer, ForeignKey("interactions.id", ondelete="CASCADE")),
    Column("material_id", Integer, ForeignKey("materials.id", ondelete="CASCADE"))
)

interaction_samples = Table(
    "interaction_samples",
    Base.metadata,
    Column("interaction_id", Integer, ForeignKey("interactions.id", ondelete="CASCADE")),
    Column("sample_id", Integer, ForeignKey("samples.id", ondelete="CASCADE"))
)

class HCP(Base):
    __tablename__ = "hcps"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    specialty = Column(String)
    organization = Column(String)
    email = Column(String)

class Material(Base):
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    type = Column(String)

class Sample(Base):
    __tablename__ = "samples"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String)

class Interaction(Base):
    __tablename__ = "interactions"
    
    id = Column(Integer, primary_key=True, index=True)
    hcp_id = Column(Integer, ForeignKey("hcps.id"))
    type = Column(String)  # Meeting, Call, Email, Webcast
    date = Column(String)  # YYYY-MM-DD
    time = Column(String)  # HH:MM
    attendees = Column(Text)  # Comma-separated names
    topics_discussed = Column(Text)
    sentiment = Column(String)  # Positive, Neutral, Negative
    outcomes = Column(Text)
    follow_up_actions = Column(Text)
    
    # Relationships
    hcp = relationship("HCP")
    materials = relationship("Material", secondary=interaction_materials)
    samples = relationship("Sample", secondary=interaction_samples)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Seed HCPs if empty
        if db.query(HCP).count() == 0:
            hcps = [
                HCP(name="Dr. Sharma", specialty="Oncology", organization="Apollo Hospital", email="sharma.oncology@apollo.com"),
                HCP(name="Dr. Smith", specialty="Cardiology", organization="Mayo Clinic", email="jsmith@mayoclinic.org"),
                HCP(name="Dr. Patel", specialty="Pediatrics", organization="Children's Health", email="patel.pediatrics@childrens.com"),
                HCP(name="Dr. Jenkins", specialty="Neurology", organization="Johns Hopkins", email="jenkins.neuro@jhmi.edu")
            ]
            db.add_all(hcps)
            
        # Seed Materials if empty
        if db.query(Material).count() == 0:
            materials = [
                Material(name="OncoBoost Phase III PDF", type="Clinical Study"),
                Material(name="CardiaShield Brochure", type="Brochure"),
                Material(name="PediatraX Detailing Slide", type="Detailing Slide"),
                Material(name="NeuroGuard Safety Information", type="Regulatory PDF")
            ]
            db.add_all(materials)
            
        # Seed Samples if empty
        if db.query(Sample).count() == 0:
            samples = [
                Sample(name="OncoBoost 10mg Starter Pack", description="Pack of 2 starter samples"),
                Sample(name="CardiaShield 50mg Trial Kit", description="Box of 5 daily capsules"),
                Sample(name="PediatraX Chewable Tabs", description="Bottle of 10 pediatric chewables"),
                Sample(name="NeuroGuard 25mg Pack", description="Pack of 4 neuro-therapy tablets")
            ]
            db.add_all(samples)
            
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
