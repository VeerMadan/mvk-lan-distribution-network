
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# (Keep your other imports like motor, pydantic, etc. here)

app = FastAPI()
limiter = Limiter(key_func=get_remote_address) # // This is the secret sauce that tells SlowAPI to identify clients by their IP address. You can customize this if you want to use API keys or something else!
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# 🛡️ THE BOUNCER: Telling FastAPI to let our frontend talk to it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all websites to connect (we will lock this to just Vercel later!)
    allow_credentials=True,
    allow_methods=["*"],  # Allows POST, GET, OPTIONS, etc.
    allow_headers=["*"],
)

# ... (Keep the rest of your database and routes exactly the same below this)

# CORS (IMPORTANT)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
import json

# 📡 WEBSOCKET MANAGER v2.0 (The Radar Engine)
class ConnectionManager:
    def __init__(self):
        # Maps the websocket connection to the agent's name!
        self.active_connections: dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, agent_name: str):
        await websocket.accept()
        self.active_connections[websocket] = agent_name

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]

    async def broadcast(self, message: str):
        # Standard database update broadcast
        for connection in self.active_connections.keys():
            try:
                await connection.send_text(message)
            except:
                pass
                
    async def broadcast_radar(self):
        # 🟢 Pings everyone with a list of who is currently online!
        online_agents = list(set(self.active_connections.values()))
        radar_ping = json.dumps({"type": "radar", "online": online_agents})
        await self.broadcast(radar_ping)

manager = ConnectionManager()

# 📡 UPGRADED WEBSOCKET ROUTE
@app.websocket("/ws/admin/{agent_name}")
async def websocket_endpoint(websocket: WebSocket, agent_name: str):
    await manager.connect(websocket, agent_name)
    await manager.broadcast_radar() # Tell the team someone logged in!
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_radar() # Tell the team someone logged out!


        
# DB
# 🛡️ Hardcoding the strings directly so Python cannot possibly fail
MONGO_URL = "mongodb+srv://veermadanmvk_db_user:veer12345@cluster0.lgefg8j.mongodb.net/mvk_db?retryWrites=true&w=majority"
DB_NAME = "mvk_db"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]



from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

# 🔐 SECURITY SETTINGS
SECRET_KEY = "mvk_super_secret_master_key_2026" # (We will hide this in environment variables later)
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    username: str
    password: str

# 🚪 THE LOGIN ENDPOINT
@app.post("/api/admin/login")
@limiter.limit("5/minute") # // This limits login attempts to 5 per minute per IP address.

async def login(request: Request, credentials: LoginRequest):
    
    # 1. Look for the user in the database
    user = await db.users.find_one({"username": credentials.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # 2. Check if the password matches the hash
    if not pwd_context.verify(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # 3. Create the VIP Pass (JWT Token) valid for 24 hours
    expire = datetime.utcnow() + timedelta(hours=24)
    token_data = {
        "sub": user["username"],
        "role": user["role"],
        "name": user["name"],
        "exp": expire
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    

    # 4. Hand the pass to the frontend
    return {
        "access_token": token,
        "role": user["role"],
        "name": user["name"],
        "username": user["username"]
    }

# THE TOKEN SCANNER : This mf ensures that every request to protected routes has a valid VIP Pass (JWT Token)
security = HTTPBearer()

async def verify_vip_pass(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # Try to decrypt the token using your master key
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(status_code=401, detail="Fake VIP Pass detected.")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Pass expired or invalid. Security called.")

class Appointment(BaseModel):
    phone: str
    customer_name: str
    property_name: str
    property_address: str
    property_image: str
    scheduled_date: str
    scheduled_time: str
    sales_rep: str
    sales_rep_phone: str

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/api/appointment")
async def get_appointment(phone: str):
    appt = await db.appointments.find_one({"phone": phone}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Not found")
    return appt

@app.post("/api/appointment/seed")
async def seed(appt: Appointment):
    data = appt.dict()
    data["id"] = str(uuid.uuid4())
    data["status"] = "pending"  

    result = await db.appointments.insert_one(data)

    data["_id"] = str(result.inserted_id)

    return data
    

# 🏆 CLOSE THE DEAL: Mark a property as officially purchased
# 👥 NEW TEAM MANAGEMENT SCHEMAS
class NewUser(BaseModel):
    username: str
    password: str
    name: str
    phone: str = "" # 📱 Added so the bot knows who to text!
    role: str = "staff"

class PropertySchema(BaseModel):
    name: str
    info: str
    image: str
    order: int = 0

class ReorderPayload(BaseModel):
    ordered_ids: list[str]

# 👨‍💻 TEAM MANAGEMENT ENDPOINTS (God Mode Only)
@app.get("/api/admin/users")
async def get_users(user: dict = Depends(verify_vip_pass)):
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Bosses only.")
    cursor = db.users.find({}, {"password_hash": 0})
    users = []
    async for doc in cursor:
        doc["id"] = str(doc.get("_id"))
        del doc["_id"]
        users.append(doc)
    return users

@app.post("/api/admin/users")
async def create_user(new_user: NewUser, user: dict = Depends(verify_vip_pass)):
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Bosses only.")
    
    existing = await db.users.find_one({"username": new_user.username})
    if existing: raise HTTPException(status_code=400, detail="Username already taken!")
    
    hashed = pwd_context.hash(new_user.password)
    await db.users.insert_one({
        "username": new_user.username, 
        "password_hash": hashed, 
        "name": new_user.name, 
        "phone": new_user.phone, # 📱 Saves the agent's WhatsApp number
        "role": new_user.role, 
        "visits_completed": 0
    })
    
    # Log the account creation into the vault!
    await db.audit_logs.insert_one({
        "action_type": "ACCOUNT_CREATED", "appointment_id": "SYSTEM", "performed_by": user.get("name"),
        "note": f"Created new {new_user.role} account for {new_user.name}",
        "timestamp": datetime.utcnow().isoformat() + "Z", "ip_address": "N/A"
    })
    return {"status": "success"}

@app.delete("/api/admin/users/{username}")
async def delete_user(username: str, admin: dict = Depends(verify_vip_pass)):
    if admin.get("role") != "admin": raise HTTPException(status_code=403, detail="Bosses only.")
    await db.users.delete_one({"username": username})
    
    await db.audit_logs.insert_one({
        "action_type": "ACCOUNT_DELETED", "appointment_id": "SYSTEM", "performed_by": admin.get("name"),
        "note": f"Revoked access for {username}",
        "timestamp": datetime.utcnow().isoformat() + "Z", "ip_address": "N/A"
    })
    return {"status": "success"}



@app.post("/api/appointment/{id}/purchase")
async def purchase_lead(id: str, request: Request, user: dict = Depends(verify_vip_pass)):query = {"id": id}if len(id) == 24:  query = {"$or": [{"id": id}, {"_id": ObjectId(id)}]}

   await db.appointments.update_one(
        query,
        {"$set": {"status": "purchased"}}
    )

  
    audit_entry = {
        "action_type": "CLOSED_DEAL",
        "appointment_id": id,
        "performed_by": user.get("name", "Unknown Agent"),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "ip_address": request.client.host
    }
    await db.audit_logs.insert_one(audit_entry)


    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    return {"status": "purchased"}
@app.post("/api/appointment/{id}/confirm")
async def confirm(id: str, request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    
    query = {"id": id}
    if len(id) == 24: 
        query = {"$or": [{"id": id}, {"_id": ObjectId(id)}]}
    
    update_data = {
        "status": "scheduled", 
    }   
    
    if data.get("scheduled_date"): update_data["scheduled_date"] = data.get("scheduled_date")
    if data.get("scheduled_time"): update_data["scheduled_time"] = data.get("scheduled_time")
        
    if data.get("customer_name"):
        update_data["customer_name"] = data.get("customer_name")
        update_data["email"] = data.get("email", "")
        update_data["location"] = data.get("location", "")

    await db.appointments.update_one(query, {"$set": update_data})

    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    return {"status": "scheduled"}


#  RESOLVE CALL: Tracks who made the call
@app.post("/api/appointment/{id}/resolve_call")
async def resolve_call(id: str, request: Request, user: dict = Depends(verify_vip_pass)):
    query = {"id": id} if len(id) != 24 else {"$or": [{"id": id}, {"_id": ObjectId(id)}]}
    
    agent_name = user.get("name", "Unknown Agent")
    await db.appointments.update_one(query, {"$set": {"status": "call_completed", "assigned_agent": agent_name}})
    
    await db.audit_logs.insert_one({
        "action_type": "COMPLETED_CALL", "appointment_id": id, "performed_by": agent_name,
        "timestamp": datetime.utcnow().isoformat() + "Z", "ip_address": request.client.host
    })
    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    return {"status": "success"}

#  SCHEDULE OFFICE VISIT
@app.post("/api/appointment/{id}/schedule_office")
async def schedule_office(id: str, request: Request, user: dict = Depends(verify_vip_pass)):
    query = {"id": id} if len(id) != 24 else {"$or": [{"id": id}, {"_id": ObjectId(id)}]}
    
    await db.appointments.update_one(query, {"$set": {"status": "office_scheduled", "assigned_agent": user.get("name")}})
    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    return {"status": "success"}
@app.post("/api/appointment/{id}/reschedule")
async def reschedule(id: str, request: Request):
    try:
        data = await request.json()
    except:
        data = {}
        
    update_data = {
        "status": "rescheduled"
    }
    
    if data.get("scheduled_date"):
        update_data["scheduled_date"] = data.get("scheduled_date")
    if data.get("scheduled_time"):
        update_data["scheduled_time"] = data.get("scheduled_time")
        
    if data.get("customer_name"):
        update_data["customer_name"] = data.get("customer_name")
    if data.get("email"):
        update_data["email"] = data.get("email")
    if data.get("location"):
        update_data["location"] = data.get("location")

    await db.appointments.update_one(
        {"id": id},
        {"$set": update_data}
    )
    
    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    return {"status": "rescheduled"}

# 🔥 CREATE OR OVERWRITE APPOINTMENT (No more duplicates!)
@app.post("/api/appointment/new")
@limiter.limit("3/minute") 
async def create_new(request: Request, appt: Appointment):
    data = appt.dict()
    data["status"] = "pending"
    # ⏱️ Stamps the exact microsecond the lead is created (Z forces UTC timezone!)
    data["created_at"] = datetime.utcnow().isoformat() + "Z"

    await db.appointments.update_one(
        {"phone": data["phone"]},
        {"$set": data},
        upsert=True
    )

    updated_doc = await db.appointments.find_one({"phone": data["phone"]})
    updated_doc["_id"] = str(updated_doc["_id"])

    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    return updated_doc


from fastapi.responses import PlainTextResponse

@app.get("/api/webhook/whatsapp")
async def verify_webhook(request: Request):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    VERIFY_TOKEN = "mvk_secure_webhook_2026"

    if mode == "subscribe" and token == VERIFY_TOKEN:
        print("✅ Meta handshake successful!")
        return PlainTextResponse(content=challenge)
        
    raise HTTPException(status_code=403, detail="Nice try, hacker.")

META_TOKEN = "EAAOPf9OyZB1IBRSjMdUZCbmJvxTWRzZAzYl1dZCBE3rLDf9oP3n7KiwkGT0jvYDlfpKl5naIbZCnnlJpZB5OJQ5OhznkmlkLFkcPBuOtSQP4By2HBNxHxGMl8QLChZCkZB7oEjSkFZBd9M92UMdZAGKhbRnrg9eZAgorHXuad8hFBSMKozYv8CWBshom2JbnsAd5QZDZD"
PHONE_NUMBER_ID = "1210633402136056" 


async def send_whatsapp_reply(to_phone: str, text: str):
    headers = {
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": { "preview_url": True, "body": text }
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages",
                headers=headers,
                json=payload
            )
            print(f"📡 META TEXT RECEIPT [{response.status_code}]: {response.text}")
        except Exception as e:
            print(f"❌ HTTPX Crash: {e}")

async def send_whatsapp_template(to_phone: str, payload: dict):
    headers = {
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages",
                headers=headers,
                json=payload
            )
            print(f"📡 META FLOW RECEIPT [{response.status_code}]: {response.text}")
        except Exception as e:
            print(f"❌ HTTPX Crash: {e}")
import time
import json


@app.post("/api/webhook/whatsapp")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    try:
        body = await request.json()
        
        if body.get("object") == "whatsapp_business_account":
            entry = body.get("entry", [{}])[0]
            changes = entry.get("changes", [{}])[0]
            value = changes.get("value", {})
            
            if "messages" in value:
                message = value["messages"][0]
                sender_phone = message.get("from")
                
                # --- 🔘 INTERACTIVE HANDLER (Flows & Buttons) ---
                if message.get("type") == "interactive":
                    interactive = message.get("interactive", {})
                    
                    # 1. Native Flow Reply (Your coworker's Silver Lake form submission)
                    if interactive.get("type") == "nfm_reply":
                        response_str = interactive.get("nfm_reply", {}).get("response_json", "{}")
                        form_data = json.loads(response_str)
                        
                        client_name = form_data.get("customer_name", "VIP Guest")
                        property_name = form_data.get("property_name", "General Inquiry")
                        visit_date = form_data.get("scheduled_date", "TBD")
                        
                        lead_data = {
                            "id": str(uuid.uuid4()),
                            "phone": sender_phone,
                            "customer_name": client_name,
                            "property_name": property_name,
                            "scheduled_date": visit_date,
                            "status": "scheduled",
                            "source": "WhatsApp Native Flow",
                            "created_at": datetime.utcnow().isoformat() + "Z" # ⏱️ Fixes future Meta Flow leads!
                        }
                        
                        await db.appointments.update_one(
                            {"phone": sender_phone},
                            {"$set": lead_data},
                            upsert=True
                        )
                        
                        await manager.broadcast("NEW_WHATSAPP_LEAD")
                        background_tasks.add_task(send_whatsapp_reply, sender_phone, f"Thank you, {client_name}! Your request for {property_name} on {visit_date} has been received.")
                        return {"status": "success"}

                    # 2. Button Reply (From our new 3-option menu)
                    elif interactive.get("type") == "button_reply":
                        button_id = interactive.get("button_reply", {}).get("id")
                        contact_name = "VIP Guest"
                        if "contacts" in value:
                            contact_name = value["contacts"][0].get("profile", {}).get("name", "VIP Guest")

                        if button_id == "btn_call":
                            # 📞 Call Requested
                            await db.appointments.update_one(
                                {"phone": sender_phone},
                                {"$set": {"status": "call_requested"}}
                            )
                            await manager.broadcast("NEW_ACTIVITY_DETECTED")
                            background_tasks.add_task(send_whatsapp_reply, sender_phone, "Thank you! A member of our MVK Sales Team will contact you shortly.")
                            return {"status": "success"}

                        elif button_id == "btn_explore":
                            # 🚀 Explore Projects -> Opens Vercel App in Webview
                            safe_phone = urllib.parse.quote_plus(sender_phone)
                            client_url = f"https://mvk-client.vercel.app/?phone={safe_phone}"
                            
                            cta_payload = {
                                "messaging_product": "whatsapp",
                                "recipient_type": "individual",
                                "to": sender_phone,
                                "type": "interactive",
                                "interactive": {
                                    "type": "cta_url",
                                    "header": { "type": "text", "text": "MVK Properties" },
                                    "body": { "text": "Tap below to explore our exclusive properties and book a site visit seamlessly." },
                                    "footer": { "text": "MVK Builders & Developers" },
                                    "action": {
                                        "name": "cta_url",
                                        "parameters": {
                                            "display_text": "Open Portal 🌐",
                                            "url": client_url
                                        }
                                    }
                                }
                            }
                            background_tasks.add_task(send_whatsapp_template, sender_phone, cta_payload)
                            return {"status": "success"}

                        elif button_id == "btn_office":
                            # 🏢 Office Visit Requested
                            await db.appointments.update_one(
                                {"phone": sender_phone},
                                {"$set": {"status": "office_visit_req"}}
                            )
                            await manager.broadcast("NEW_ACTIVITY_DETECTED")
                            background_tasks.add_task(send_whatsapp_reply, sender_phone, "Great! Our team will reach out shortly to schedule your visit to the MVK Headquarters.")
                            return {"status": "success"}

                # --- 💬 TEXT HANDLER (When user says "Hi") ---
                if message.get("type") == "text":
                    contact_name = "VIP Guest"
                    if "contacts" in value:
                        contact_name = value["contacts"][0].get("profile", {}).get("name", "VIP Guest")

                    message_body = message.get("text", {}).get("body", "")
                    
                    # Register them as a pending lead in Command Center
                    initial_lead = {
                        "id": str(uuid.uuid4()),
                        "phone": sender_phone,
                        "customer_name": contact_name, 
                        "status": "pending", 
                        "latest_inquiry": message_body,
                        "source": "WhatsApp Bot",
                        "created_at": datetime.utcnow().isoformat() + "Z"
                    }
                    
                    await db.appointments.update_one(
                        {"phone": sender_phone},
                        {"$set": initial_lead},
                        upsert=True
                    )
                    await manager.broadcast("NEW_WHATSAPP_LEAD")

                    # Send the new 2-button Interactive Menu!
                    menu_payload = {
                        "messaging_product": "whatsapp",
                        "to": sender_phone,
                        "type": "interactive",
                        "interactive": {
                            "type": "button",
                            "body": {
                                "text": f"Welcome to MVK Builders, {contact_name}! 🏢\n\nAre you here to explore our exclusive Silver Lake property, or would you like to schedule a private site visit?"
                            },
                            "action": {
                                "buttons": [
                                    {
                                        "type": "reply",
                                        "reply": {
                                            "id": "btn_call",
                                            "title": "Request Call Back"
                                        }
                                    },
                                    {
                                        "type": "reply",
                                        "reply": {
                                            "id": "btn_explore",
                                            "title": "Explore Projects"
                                        }
                                    },
                                    {
                                        "type": "reply",
                                        "reply": {
                                            "id": "btn_office",
                                            "title": "Book Office Visit"
                                        }
                                    }
                                ]
                            }
                        }
                    }
                    background_tasks.add_task(send_whatsapp_template, sender_phone, menu_payload)
                    
        return {"status": "success"}
    except Exception as e:
        print(f"Webhook error: {e}")
        return {"status": "error"}
    
from datetime import datetime 


@app.post("/api/appointment/{id}/cancel")
async def cancel(id: str, request: Request):
    try:
        # // catching whatever the frontend threw at us
        data = await request.json()
    except:
        data = {}

    # 🔥 Bulletproof ID query (Matches standard ID or MongoDB's internal _id)
    query = {"id": id}
    if len(id) == 24: 
        query = {"$or": [{"id": id}, {"_id": ObjectId(id)}]}

    # // 1. Update the actual appointment status
    cancel_reason = data.get("reason", "Admin Declined / No Reason Provided")
    cancel_note = data.get("note", "")
    declined_by = data.get("admin_name", "System Default") # // Who pushed the button?

    await db.appointments.update_one(
        query,
        {"$set": {
            "status": "cancelled",
            "cancel_reason": cancel_reason,
            "cancel_note": cancel_note
        }}
    )
    
    # // 2. THE VAULT: Write this action to the permanent permanent record 📝
    audit_entry = {
        "action_type": "DECLINE",
        "appointment_id": id,
        "performed_by": declined_by,
        "reason": cancel_reason,
        "note": cancel_note,
        "timestamp": datetime.utcnow().isoformat(), # // UTC time so it's bulletproof
        "ip_address": request.client.host # // logging their IP just in case they try to lie lmao
    }
    await db.audit_logs.insert_one(audit_entry)
    
    #  BROADCAST UPDATE TO ADMIN PANEL
    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    return {"status": "cancelled"}

#  THE FINISH LINE: Mark a visit as complete and give the agent a point
@app.post("/api/appointment/{id}/complete")
# 🚮 THE NUCLEAR OPTION: Permanently delete a lead

@app.get("/api/admin/stats")
async def get_team_stats(user: dict = Depends(verify_vip_pass)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bosses only.")

    try:
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_counts = await db.appointments.aggregate(pipeline).to_list(length=None)
        
        stats = {"pending": 0, "scheduled": 0, "completed": 0, "cancelled": 0}
        for item in status_counts:
            status_key = item.get("_id")
            if status_key in stats:
                stats[status_key] = item.get("count", 0)
                
        agents_cursor = db.users.find({"role": "staff"}).sort("visits_completed", -1)
        agents = await agents_cursor.to_list(length=10)
        
        leaderboard = []
        for a in agents:
            leaderboard.append({
                "name": a.get("name", "Unknown"), 
                "score": a.get("visits_completed", 0)
            })

        return {
            "overview": stats, 
            "leaderboard": leaderboard
        }
        
    except Exception as e:
        print(f"Stats engine crashed: {e}")
        return {"error": "Failed to calculate stats"}

# 🏗️ THE HEADLESS CMS: Dynamic Property Manager
@app.get("/api/properties")
async def get_properties():
    cursor = db.properties.find({}).sort("order", 1) # 🔃 Sorts them by your custom order!
    properties = []
    async for doc in cursor:
        doc["id"] = str(doc.get("_id"))
        if "_id" in doc: del doc["_id"]
        properties.append(doc)
    return properties

# 🛡️ Changed to POST to bypass Cloud Proxy 405 Firewalls!
@app.post("/api/admin/properties/{id}/update")
async def update_property(id: str, prop: PropertySchema, user: dict = Depends(verify_vip_pass)):
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Bosses only.")
    
    await db.properties.update_one({"_id": ObjectId(id)}, {"$set": prop.dict()})
    
    await db.audit_logs.insert_one({
        "action_type": "CMS_UPDATE", "appointment_id": "SYSTEM", "performed_by": user.get("name"),
        "note": f"Updated property details: {prop.name}",
        "timestamp": datetime.utcnow().isoformat() + "Z", "ip_address": "N/A"
    })
    return {"status": "success"}

@app.post("/api/admin/properties/reorder")
async def reorder_properties(payload: ReorderPayload, user: dict = Depends(verify_vip_pass)):
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Bosses only.")
    
    # Updates the index order of every property instantly!
    for index, prop_id in enumerate(payload.ordered_ids):
        await db.properties.update_one({"_id": ObjectId(prop_id)}, {"$set": {"order": index}})
    return {"status": "success"}

@app.post("/api/admin/properties")
async def add_property(prop: PropertySchema, user: dict = Depends(verify_vip_pass)):
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Bosses only.")
    
    # ➕ Adds new projects to the very end of the carousel
    count = await db.properties.count_documents({})
    prop_data = prop.dict()
    prop_data["order"] = count
    
    await db.properties.insert_one(prop_data)
    
    await db.audit_logs.insert_one({
        "action_type": "CMS_UPDATE", "appointment_id": "SYSTEM", "performed_by": user.get("name"),
        "note": f"Added new property to carousel: {prop.name}",
        "timestamp": datetime.utcnow().isoformat() + "Z", "ip_address": "N/A"
    })
    return {"status": "success"}

@app.delete("/api/admin/properties/{id}")
async def delete_property(id: str, user: dict = Depends(verify_vip_pass)):
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Bosses only.")
    
    await db.properties.delete_one({"_id": ObjectId(id)})
    
    await db.audit_logs.insert_one({
        "action_type": "CMS_UPDATE", "appointment_id": "SYSTEM", "performed_by": user.get("name"),
        "note": f"Deleted property from carousel",
        "timestamp": datetime.utcnow().isoformat() + "Z", "ip_address": "N/A"
    })
    return {"status": "success"}


@app.delete("/api/appointment/{id}")
async def delete_appointment(id: str, user: dict = Depends(verify_vip_pass)):
    # 🔒 Only Admins can delete
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized: Only the Boss can delete entries.")

    query = {"id": id}
    if len(id) == 24: 
        query = {"$or": [{"id": id}, {"_id": ObjectId(id)}]}

    result = await db.appointments.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Wake up the frontend to remove the card!
    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    return {"status": "deleted"}
async def complete_visit(id: str, request: Request, user: dict = Depends(verify_vip_pass)):
    query = {"id": id}
    if len(id) == 24: 
        query = {"$or": [{"id": id}, {"_id": ObjectId(id)}]}

    # 1. Update the appointment status to complete
    await db.appointments.update_one(
        query,
        {"$set": {"status": "completed"}}
    )

    # 2.  GAMIFICATION: Add +1 to the agent's completed visits score!
    await db.users.update_one(
        {"username": user.get("sub")},
        {"$inc": {"visits_completed": 1}}
    )

    # 3.  THE VAULT: Log this so you can track who is closing the most deals
    audit_entry = {
        "action_type": "COMPLETED_VISIT",
        "appointment_id": id,
        "performed_by": user.get("name"),
        "timestamp": datetime.utcnow().isoformat(),
        "ip_address": request.client.host
    }
    await db.audit_logs.insert_one(audit_entry)

    # 📢 Ping everyone's dashboard
    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    
    return {"status": "completed"}




# 🙋 THE CLAIM ROUTE: Staff members volunteer for a site visit
@app.post("/api/appointment/{id}/assign")
async def assign_agent(id: str, request: Request, background_tasks: BackgroundTasks, user: dict = Depends(verify_vip_pass)):
    # 1. Bulletproof ID query
    query = {"id": id}
    if len(id) == 24: 
        query = {"$or": [{"id": id}, {"_id": ObjectId(id)}]}

    # 2. Check if it's already claimed so agents don't fight over it
    existing = await db.appointments.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Lead vanished into the void.")
    if existing.get("assigned_agent"):
        raise HTTPException(status_code=400, detail=f"Too slow! {existing.get('assigned_agent')} already took this one.")

    # 3. Lock it to the staff member who clicked the button
    await db.appointments.update_one(
        query,
        {"$set": {
            "assigned_agent": user.get("name", "Unknown Agent"),
            "assigned_agent_username": user.get("sub", "unknown") # 🛡️ Fixed! Looks for "sub" safely
        }}
    )

    # 4. 📝 THE VAULT: Log this action so you (the Boss) can track performance
    audit_entry = {
        "action_type": "CLAIMED_LEAD",
        "appointment_id": id,
        "performed_by": user["name"],
        "reason": "Volunteered for site visit",
        "timestamp": datetime.utcnow().isoformat(),
        "ip_address": request.client.host
    }
    await db.audit_logs.insert_one(audit_entry)
    await manager.broadcast("NEW_ACTIVITY_DETECTED")
    
    # 📱 AUTOMATED DISPATCH: Ping the agent's WhatsApp!
    agent_data = await db.users.find_one({"username": user.get("sub")})
    if agent_data and agent_data.get("phone"):
        client_name = existing.get("customer_name", "A VIP Guest")
        client_phone = existing.get("phone", "Unknown Number")
        prop_name = existing.get("property_name", "a property")
        
        dispatch_msg = f"🚨 *NEW LEAD ASSIGNED* 🚨\n\nHi {user.get('name')}, you have successfully claimed a new site visit.\n\n👤 *Client:* {client_name}\n📞 *Phone:* {client_phone}\n🏢 *Property:* {prop_name}\n\nPlease reach out to them immediately to coordinate the visit!"
        
        # We reuse the WhatsApp function we built for the bot!
        background_tasks.add_task(send_whatsapp_reply, agent_data.get("phone"), dispatch_msg)
    
    return {"status": "claimed", "assigned_to": user["name"]}


@app.get("/api/admin/audits")
async def get_audit_logs(user: dict = Depends(verify_vip_pass)):
  
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nice try. Bosses only.")

    try:
        # // pull everything from the vault, newest first
        cursor = db.audit_logs.find({}).sort("timestamp", -1)
        
        logs = []
        async for doc in cursor:
            doc["id"] = str(doc.get("_id"))
            if "_id" in doc:
                del doc["_id"] 
            logs.append(doc)
            
        return logs
    except Exception as e:
        print(f"Audit fetch failed. The feds are watching: {e}")
        return []
    
@app.get("/api/admin/appointments")
async def get_all_appointments(user: dict = Depends(verify_vip_pass)):
    try:
        cursor = db.appointments.find({}).sort("_id", -1)
        
        appointments = []
        async for doc in cursor:
            doc["id"] = str(doc.get("_id"))
            if "_id" in doc:
                del doc["_id"] 
                
            appointments.append(doc)
            
        print(f"Found {len(appointments)} appointments.")
        return appointments
        
    except Exception as e:
        print(f"Backend crashed while fetching: {e}")
        return {"detail": "Database left us on read"}
