import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Database and Agent imports
from database import SessionLocal, init_db, HCP, Material, Sample, Interaction, interaction_materials, interaction_samples
from agent import run_agent

load_dotenv()

app = FastAPI(title="AI-First CRM HCP Module API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Startup event to initialize database
@app.on_event("startup")
def startup_event():
    init_db()

# --- PYDANTIC SCHEMAS ---

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    current_fields: Dict[str, Any]

class InteractionCreate(BaseModel):
    hcp_id: Optional[int] = None
    hcp_name: Optional[str] = None
    type: str
    date: str
    time: str
    attendees: Optional[str] = ""
    topics_discussed: Optional[str] = ""
    materials: List[str] = []
    samples: List[str] = []
    sentiment: str
    outcomes: Optional[str] = ""
    follow_up_actions: Optional[str] = ""

# --- ENDPOINTS ---

@app.get("/api/hcps")
def get_hcps(db: Session = Depends(get_db)):
    hcps = db.query(HCP).all()
    return [{"id": h.id, "name": h.name, "specialty": h.specialty, "organization": h.organization, "email": h.email} for h in hcps]

@app.get("/api/materials")
def get_materials(db: Session = Depends(get_db)):
    mats = db.query(Material).all()
    return [{"id": m.id, "name": m.name, "type": m.type} for m in mats]

@app.get("/api/samples")
def get_samples(db: Session = Depends(get_db)):
    samps = db.query(Sample).all()
    return [{"id": s.id, "name": s.name, "description": s.description} for s in samps]

@app.post("/api/chat")
def chat_endpoint(payload: ChatRequest):
    try:
        # Convert ChatMessage items to standard dicts
        chat_history = [{"role": msg.role, "content": msg.content} for msg in payload.messages]
        
        # Run LangGraph Agent
        result = run_agent(chat_history, payload.current_fields)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/interactions")
def save_interaction(payload: InteractionCreate, db: Session = Depends(get_db)):
    try:
        # Resolve HCP ID if only HCP name is provided
        hcp_id = payload.hcp_id
        if not hcp_id and payload.hcp_name:
            hcp = db.query(HCP).filter(HCP.name.like(f"%{payload.hcp_name}%")).first()
            if hcp:
                hcp_id = hcp.id
            else:
                # Add new HCP on the fly if needed, or default to a dummy
                new_hcp = HCP(name=payload.hcp_name, specialty="General", organization="Unknown", email="")
                db.add(new_hcp)
                db.commit()
                db.refresh(new_hcp)
                hcp_id = new_hcp.id

        # Create interaction
        interaction = Interaction(
            hcp_id=hcp_id,
            type=payload.type,
            date=payload.date,
            time=payload.time,
            attendees=payload.attendees,
            topics_discussed=payload.topics_discussed,
            sentiment=payload.sentiment,
            outcomes=payload.outcomes,
            follow_up_actions=payload.follow_up_actions
        )
        
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

        # Associate materials
        for mat_name in payload.materials:
            mat = db.query(Material).filter(Material.name == mat_name).first()
            if mat:
                db.execute(
                    interaction_materials.insert().values(
                        interaction_id=interaction.id,
                        material_id=mat.id
                    )
                )

        # Associate samples
        for samp_name in payload.samples:
            samp = db.query(Sample).filter(Sample.name == samp_name).first()
            if samp:
                db.execute(
                    interaction_samples.insert().values(
                        interaction_id=interaction.id,
                        sample_id=samp.id
                    )
                )
                
        db.commit()
        return {"status": "success", "id": interaction.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
