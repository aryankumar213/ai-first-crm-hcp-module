import os
import json
import re
import datetime
from typing import List, Dict, Any, TypedDict, Optional
from pydantic import BaseModel, Field

# LangChain / LangGraph imports
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END

# Import database session to query materials and samples for matching
from database import SessionLocal, HCP, Material, Sample

# Define State Schema
class AgentState(TypedDict):
    messages: List[BaseMessage]
    extracted_fields: Dict[str, Any]
    missing_fields: List[str]
    suggested_followups: List[str]

# Schema for structured output
class InteractionExtraction(BaseModel):
    hcp_name: Optional[str] = Field(None, description="Name of the HCP, e.g. Dr. Sharma or Dr. Smith")
    interaction_type: Optional[str] = Field(None, description="Type of interaction, e.g. Meeting, Call, Email, Webcast")
    date: Optional[str] = Field(None, description="Date of the interaction in YYYY-MM-DD format")
    time: Optional[str] = Field(None, description="Time of the interaction in HH:MM format")
    attendees: List[str] = Field(default_factory=list, description="Names of other attendees in the interaction")
    topics_discussed: Optional[str] = Field(None, description="Key discussion points and topics")
    materials: List[str] = Field(default_factory=list, description="Names of materials shared, matching clinical brochures or PDFs")
    samples: List[str] = Field(default_factory=list, description="Names of samples distributed")
    sentiment: Optional[str] = Field("Neutral", description="Observed sentiment: Positive, Neutral, Negative")
    outcomes: Optional[str] = Field(None, description="Key outcomes or agreements")
    follow_up_actions: Optional[str] = Field(None, description="Next steps or tasks agreed upon")
    suggested_followups: List[str] = Field(default_factory=list, description="AI suggested next steps/actions to recommend to the user")

def get_db_lists():
    db = SessionLocal()
    try:
        hcps = [h.name for h in db.query(HCP).all()]
        materials = [m.name for m in db.query(Material).all()]
        samples = [s.name for s in db.query(Sample).all()]
        return hcps, materials, samples
    finally:
        db.close()

# --- MOCK EXTRACTOR FOR FALLBACK MODE ---
def run_mock_extraction(text: str, current_fields: Dict[str, Any]) -> Dict[str, Any]:
    """Smart heuristic parsing of user text to extract CRM fields without an LLM."""
    fields = current_fields.copy()
    hcps, materials, samples = get_db_lists()
    
    # 1. HCP Name Match
    for hcp in hcps:
        if hcp.lower() in text.lower():
            fields["hcp_name"] = hcp
            break
    if not fields.get("hcp_name"):
        match = re.search(r"dr\.\s*[a-z]+", text, re.IGNORECASE)
        if match:
            # Try to match capitalize
            doc_name = match.group(0)
            # Find in list case insensitively
            found = False
            for h in hcps:
                if h.lower() in doc_name.lower() or doc_name.lower() in h.lower():
                    fields["hcp_name"] = h
                    found = True
                    break
            if not found:
                fields["hcp_name"] = doc_name.title()

    # 2. Interaction Type
    if any(kwd in text.lower() for kwd in ["met", "meeting", "face to face", "f2f", "discussion"]):
        fields["interaction_type"] = "Meeting"
    elif any(kwd in text.lower() for kwd in ["called", "phone", "call", "teleconference"]):
        fields["interaction_type"] = "Call"
    elif any(kwd in text.lower() for kwd in ["emailed", "email", "sent mail"]):
        fields["interaction_type"] = "Email"
    elif any(kwd in text.lower() for kwd in ["webinar", "webcast", "zoom", "online"]):
        fields["interaction_type"] = "Webcast"
        
    # 3. Date & Time
    if "today" in text.lower():
        fields["date"] = datetime.date.today().strftime("%Y-%m-%d")
    elif "yesterday" in text.lower():
        fields["date"] = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        # Match YYYY-MM-DD or DD-MM-YYYY
        date_match = re.search(r"(\d{4}-\d{2}-\d{2})|(\d{2}-\d{2}-\d{4})", text)
        if date_match:
            fields["date"] = date_match.group(0)
            
    # Set default date and time if not set
    if not fields.get("date"):
        fields["date"] = datetime.date.today().strftime("%Y-%m-%d")
    if not fields.get("time"):
        fields["time"] = datetime.datetime.now().strftime("%H:%M")

    # 4. Sentiment
    if any(w in text.lower() for w in ["positive", "happy", "excited", "receptive", "interested", "good"]):
        fields["sentiment"] = "Positive"
    elif any(w in text.lower() for w in ["negative", "uninterested", "skeptical", "unhappy", "bad"]):
        fields["sentiment"] = "Negative"
    else:
        # Keep existing or set Neutral
        if not fields.get("sentiment"):
            fields["sentiment"] = "Neutral"

    # 5. Materials Shared
    shared_mats = fields.get("materials", [])
    for mat in materials:
        # match parts, e.g. "OncoBoost Phase III" or "OncoBoost brochure"
        short_name = mat.split(" ")[0].lower()
        if mat.lower() in text.lower() or (short_name in text.lower() and "brochure" in text.lower()):
            if mat not in shared_mats:
                shared_mats.append(mat)
    fields["materials"] = shared_mats

    # 6. Samples Distributed
    dist_samples = fields.get("samples", [])
    for samp in samples:
        short_name = samp.split(" ")[0].lower()
        if samp.lower() in text.lower() or (short_name in text.lower() and "sample" in text.lower()):
            if samp not in dist_samples:
                dist_samples.append(samp)
    fields["samples"] = dist_samples

    # 7. Topics Discussed
    # Try to extract what is after "discussed" or "talked about"
    disc_match = re.search(r"(?:discussed|talked about|shared details on)\s+([^.]+)", text, re.IGNORECASE)
    if disc_match:
        extracted_topics = disc_match.group(1).strip()
        if fields.get("topics_discussed"):
            # Append if not duplicate
            if extracted_topics.lower() not in fields["topics_discussed"].lower():
                fields["topics_discussed"] += f", {extracted_topics}"
        else:
            fields["topics_discussed"] = extracted_topics.capitalize()

    # 8. Outcomes & Follow-up Actions
    outcomes_match = re.search(r"(?:outcome|resulted in|agreed to|he said|she said)\s+([^.]+)", text, re.IGNORECASE)
    if outcomes_match:
        extracted_outcomes = outcomes_match.group(1).strip()
        if fields.get("outcomes"):
            if extracted_outcomes.lower() not in fields["outcomes"].lower():
                fields["outcomes"] += f", {extracted_outcomes}"
        else:
            fields["outcomes"] = extracted_outcomes.capitalize()

    followup_match = re.search(r"(?:follow up|next steps|next step|todo|will send)\s+([^.]+)", text, re.IGNORECASE)
    if followup_match:
        extracted_follow = followup_match.group(1).strip()
        if fields.get("follow_up_actions"):
            if extracted_follow.lower() not in fields["follow_up_actions"].lower():
                fields["follow_up_actions"] += f", {extracted_follow}"
        else:
            fields["follow_up_actions"] = extracted_follow.capitalize()

    # 9. Suggest follow-ups based on text
    suggestions = []
    if "weeks" in text.lower() or "follow up" in text.lower():
        suggestions.append("Schedule follow-up meeting in 2 weeks")
    if "oncoboost" in text.lower() or "pdf" in text.lower() or "study" in text.lower():
        suggestions.append("Send OncoBoost Phase III PDF")
    if fields.get("hcp_name") and ("positive" in text.lower() or "interested" in text.lower()):
        hname = fields.get("hcp_name")
        suggestions.append(f"Add {hname} to advisory board invite list")
    
    # Defaults if empty
    if not suggestions:
        suggestions = [
            "Schedule follow-up meeting in 2 weeks",
            "Send OncoBoost Phase III PDF",
            f"Add {fields.get('hcp_name', 'HCP')} to advisory board invite list"
        ]
        
    fields["suggested_followups"] = suggestions
    return fields

# --- NODES ---

def extract_fields_node(state: AgentState) -> Dict[str, Any]:
    """Node that extracts structured information from the chat history."""
    last_message = state["messages"][-1].content
    current_fields = state.get("extracted_fields", {})
    
    from dotenv import load_dotenv
    load_dotenv(override=True)
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        # Use Fallback Mock Extraction
        updated_fields = run_mock_extraction(last_message, current_fields)
        return {
            "extracted_fields": updated_fields,
            "suggested_followups": updated_fields.get("suggested_followups", [])
        }
    
    try:
        # Query database to give schema context to LLM
        hcps, materials, samples = get_db_lists()
        
        # Initialize Groq LLM
        # gemma2-9b-it is recommended by user, llama-3.3-70b-versatile is also available
        llm = ChatGroq(
            groq_api_key=api_key,
            model_name="llama-3.3-70b-versatile",
            temperature=0.0
        )
        
        # Define extraction system prompt
        system_prompt = f"""
You are an expert life science virtual assistant parsing interactions logged by pharmaceutical/medical sales reps.
Your task is to extract structured details from their chat descriptions.

Pre-seeded database entries for reference:
- Available HCPs: {hcps}
- Available Materials: {materials}
- Available Samples: {samples}

Extract the following fields into JSON:
- hcp_name: Must match one of the available HCPs or extract the doctor's name if not present.
- interaction_type: 'Meeting', 'Call', 'Email', or 'Webcast'.
- date: YYYY-MM-DD format (assume today is {datetime.date.today().strftime('%Y-%m-%d')} unless specified otherwise).
- time: HH:MM format (assume current time is {datetime.datetime.now().strftime('%H:%M')} if not specified).
- attendees: List of other people present.
- topics_discussed: Key details discussed.
- materials: List of materials shared. Must match available materials if they match closely.
- samples: List of samples distributed. Must match available samples if they match closely.
- sentiment: 'Positive', 'Neutral', or 'Negative'.
- outcomes: Key decisions, results, or outcomes.
- follow_up_actions: Actions the rep promised to do.
- suggested_followups: A list of 2-3 logical next-step titles, e.g. "Schedule follow-up meeting in 2 weeks" or "Send OncoBoost Phase III PDF".

Merge these new details into the existing fields: {json.dumps(current_fields)}
Only overwrite fields if the new input provides updated details. Maintain existing values otherwise.
"""
        
        # Structured output calling with Pydantic
        structured_llm = llm.with_structured_output(InteractionExtraction)
        
        # Compile prompt
        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Last Rep log/input: '{last_message}'\nExtract and merge fields.")
        ])
        
        result = structured_llm.invoke(prompt.format_messages())
        
        # Convert Pydantic model to dictionary
        extracted = result.model_dump()
        
        # suggested follow-ups
        s_followups = extracted.pop("suggested_followups", [])
        if not s_followups:
            s_followups = [
                "Schedule follow-up meeting in 2 weeks",
                "Send OncoBoost Phase III PDF",
                f"Add {extracted.get('hcp_name') or 'HCP'} to advisory board invite list"
            ]
            
        return {
            "extracted_fields": extracted,
            "suggested_followups": s_followups
        }
        
    except Exception as e:
        print(f"Error calling Groq API: {e}. Falling back to mock extraction.")
        updated_fields = run_mock_extraction(last_message, current_fields)
        return {
            "extracted_fields": updated_fields,
            "suggested_followups": updated_fields.get("suggested_followups", [])
        }

def validate_fields_node(state: AgentState) -> Dict[str, Any]:
    """Node that checks for missing required fields."""
    fields = state["extracted_fields"]
    missing = []
    
    if not fields.get("hcp_name"):
        missing.append("HCP Name")
    if not fields.get("topics_discussed"):
        missing.append("Topics Discussed")
    if not fields.get("interaction_type"):
        missing.append("Interaction Type")
        
    return {"missing_fields": missing}

def generate_response_node(state: AgentState) -> Dict[str, Any]:
    """Node that generates a conversational chat response summarizing findings or asking for more details."""
    fields = state["extracted_fields"]
    missing = state["missing_fields"]
    
    from dotenv import load_dotenv
    load_dotenv(override=True)
    api_key = os.environ.get("GROQ_API_KEY")
    
    if missing:
        missing_str = ", ".join(missing)
        response_text = f"I've updated the interaction details. To complete the log, could you please specify the **{missing_str}**?"
    else:
        hcp = fields.get('hcp_name')
        itype = fields.get('interaction_type')
        response_text = f"Great! I have successfully extracted all key details for your **{itype}** with **{hcp}**.\n\n"
        response_text += f"- **Topics**: {fields.get('topics_discussed')}\n"
        if fields.get('materials'):
            response_text += f"- **Materials**: {', '.join(fields.get('materials'))}\n"
        if fields.get('samples'):
            response_text += f"- **Samples**: {', '.join(fields.get('samples'))}\n"
        response_text += f"- **Sentiment**: {fields.get('sentiment')}\n\n"
        response_text += "You can review the updated form on the left. Click **Log** to finalize and save this interaction."

    if not api_key:
        # Mock mode response addition
        response_text = "*(Running in AI Simulator Mode)*\n\n" + response_text
        return {"messages": [AIMessage(content=response_text)]}

    try:
        llm = ChatGroq(
            groq_api_key=api_key,
            model_name="llama-3.3-70b-versatile",
            temperature=0.7
        )
        
        system_prompt = f"""
You are an AI assistant in a CRM for pharmaceutical sales representatives.
Your task is to respond to the user dynamically based on the current state of the interaction logging.

Here is the current state of extracted fields:
{json.dumps(fields)}

Here is the list of missing fields:
{missing}

Write a natural, conversational response. If fields are missing, ask for them politely and give suggestions.
If all fields are successfully extracted, congratulate them, summarize key elements (HCP, type, topics, materials, sentiment), and guide them to save the interaction.
Keep the response professional, concise, and focused on helping the sales representative.
"""
        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=system_prompt),
            state["messages"][-1]
        ])
        
        response = llm.invoke(prompt.format_messages())
        return {"messages": [response]}
        
    except Exception as e:
        print(f"Error generating LLM response: {e}")
        # Return fallback response
        return {"messages": [AIMessage(content="*(Fallback)* " + response_text)]}

# --- BUILD THE LANGGRAPH ---

def build_workflow():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("extractor", extract_fields_node)
    workflow.add_node("validator", validate_fields_node)
    workflow.add_node("generator", generate_response_node)
    
    # Set edges
    workflow.set_entry_point("extractor")
    workflow.add_edge("extractor", "validator")
    workflow.add_edge("validator", "generator")
    workflow.add_edge("generator", END)
    
    return workflow.compile()

# Global compiled agent workflow
agent_app = build_workflow()

def run_agent(chat_history: List[Dict[str, str]], current_form_fields: Dict[str, Any]) -> Dict[str, Any]:
    """Runs the LangGraph agent workflow with the full conversation history and current form state."""
    # Convert dict messages to langchain BaseMessage list
    messages = []
    for msg in chat_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
            
    # Initial state
    initial_state = {
        "messages": messages,
        "extracted_fields": current_form_fields,
        "missing_fields": [],
        "suggested_followups": []
    }
    
    # Run graph
    final_state = agent_app.invoke(initial_state)
    
    # Return output
    last_msg = final_state["messages"][-1].content
    return {
        "reply": last_msg,
        "extracted_fields": final_state["extracted_fields"],
        "suggested_followups": final_state["suggested_followups"]
    }
