from flask import Flask, request, send_file, jsonify
import re
import uuid
import os
import logging
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from datetime import datetime
from backend.utils.pdf_generator import create_document
from backend.bulk_certificate import process_bulk_certificates
from backend.db_utils import (
    store_certificate, store_notice, init_collections,
    get_user_by_username, insert_user, get_user_by_id,
    get_all_users, update_user_by_id, delete_user_by_id,
    update_user_password, get_certificate_by_id, get_db_connection,
    user_exists
)
import traceback
import warnings
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import jwt
import datetime as dt
from functools import wraps
from backend.llm_client import check_llm_health

# =====================
# Logging Setup
# =====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress the pkg_resources deprecation warning
warnings.filterwarnings("ignore", message="pkg_resources is deprecated")

# =====================
# Flask App Setup
# =====================
app = Flask(__name__)

# Environment-based configuration
ENV = os.getenv('ENV', 'dev')
DEBUG = ENV == 'dev'  # Debug only in development

logger.info(f"Starting Flask app in {ENV} mode (Debug: {DEBUG})")

# CORS configuration
allowed_origins = os.getenv(
    'CORS_ORIGINS',
    'http://localhost:5173,http://localhost:5174'
).split(',')
CORS(app, supports_credentials=True, origins=allowed_origins)

# JWT Secret Key (use environment variable in production)
app.config['SECRET_KEY'] = os.getenv(
    'JWT_SECRET_KEY',
    'your-secret-key-change-this-in-production' if ENV == 'dev' else None
)

if not app.config['SECRET_KEY']:
    logger.error("FATAL: JWT_SECRET_KEY not set in production!")
    raise RuntimeError("JWT_SECRET_KEY must be set via environment variable")

logger.info(f"LLM Status - Gemini: {bool(os.getenv('GEMINI_API_KEY'))}, Groq: {bool(os.getenv('GROQ_API_KEY'))}")

# =====================
# Database Configuration
# =====================
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'documents_db')


def get_db():
    """Get MongoDB database connection."""
    return get_db_connection()



def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token is invalid'}), 401
        
        return f(current_user_id, *args, **kwargs)
    return decorated_function

# =============================
# Database setup for collections
# =============================
def init_db():
    """Initialize MongoDB collections."""
    init_collections()

# Create default admin user if it doesn't exist
def create_default_admin():
    db = get_db_connection()
    try:
        # Check if admin user exists
        if not user_exists('admin'):
            # Create default admin user
            hashed_password = generate_password_hash('admin123')
            insert_user('admin', hashed_password, 'admin')
            print("Default admin user created: username='admin', password='admin123'")
    except Exception as e:
        print(f"Error creating default admin: {e}")

init_db()
create_default_admin()




def verify_certificate(doc_id):
    result = get_certificate_by_id(doc_id)
    
    if result:
        return {
            "id": result['_id'],
            "recipient_name": result['recipient_name'],
            "event_name": result['event_name'],
            "date": result['date'],
            "role": result['role'],
            "doc_type": result['doc_type'],
            "created_at": str(result['created_at']),
            "valid": True
        }
    return {"valid": False}


# Ensure upload folder exists
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploaded_templates')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route('/upload-template', methods=['POST'])
def upload_template():
    # Expects multipart/form-data with 'file' and 'docType'
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    doc_type = request.form.get('docType', '') or request.args.get('docType', '')
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if not doc_type:
        return jsonify({'error': 'docType required'}), 400

    filename = secure_filename(file.filename)
    # Save timestamped copy and also update latest pointer
    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    base_name = f"{doc_type}_{ts}.docx"
    saved_path = os.path.join(UPLOAD_FOLDER, base_name)
    try:
        file.save(saved_path)

        # Update latest link
        latest_path = os.path.join(UPLOAD_FOLDER, f"{doc_type}_latest.docx")
        # Overwrite latest copy
        with open(saved_path, 'rb') as src, open(latest_path, 'wb') as dst:
            dst.write(src.read())

        # Return only the filename for safer path resolution
        return jsonify({'message': 'Uploaded', 'filename': f"{doc_type}_latest.docx"}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/template/<doc_type>', methods=['GET'])
def get_latest_template(doc_type):
    latest_path = os.path.join(UPLOAD_FOLDER, f"{doc_type}_latest.docx")
    if os.path.exists(latest_path):
        return send_file(latest_path, as_attachment=True, download_name=f"{doc_type}_latest.docx")
    return jsonify({'error': 'No template found for this docType'}), 404


# =============================
# Root Endpoint
# =============================
@app.route('/', methods=['GET'])
def root():
    """Root endpoint for health checks and status."""
    return jsonify({'status': 'API running', 'app': 'Smart Document Generator'}), 200


# =============================
# Health Check Endpoints
# =============================
@app.route('/health', methods=['GET'])
def health_check():
    """Basic health check endpoint."""
    return jsonify({
        'status': 'ok',
        'environment': ENV,
        'version': '1.0.0'
    }), 200


@app.route('/health/llm', methods=['GET'])
def health_llm():
    """Check LLM availability (Gemini + Groq)."""
    health = check_llm_health()
    status_code = 200 if health['test'] == 'passed' else 503
    return jsonify(health), status_code


# =============================
# Document Generation Endpoint
# =============================
@app.route('/generate-document', methods=['POST'])
def generate_document_endpoint():
    """
    Generate a document (letter, certificate, circular, notice).
    Uses LLM with Gemini → Groq fallback for content generation.
    """
    data = request.get_json() or {}
    logger.info(f"Document generation requested: doc_type={data.get('docType')}")
    doc_type = data.get("docType", "")
    
    # Validate input
    if not doc_type:
        logger.warning("Missing docType in request")
        return jsonify({'error': 'docType is required'}), 400
    
    date = data.get("date", "")
    sender_details = data.get("sender_details", "")
    recipient_details = data.get("recipient_details", "")
    role = data.get("role", "")
    name1=data.get("Name1", "")
    name2=data.get("Name2", " ")
    purpose = data.get("purpose", "")
    event_details = data.get("eventDetails", "")
    title = data.get("Title", "")
    venue = data.get("venue", "")
    event_name = data.get("eventName", "")
    doc_id = str(uuid.uuid4())

    try:
        # Store certificate or notice info if applicable
        if doc_type == "certificate":
            store_certificate(doc_id, name1, event_name, date, role, doc_type)
        elif doc_type == "notice":
            store_notice(doc_id, title, name1, name2, date, venue, data.get("template", "notice_template.docx"))

        # Match template keys correctly
        placeholders = {
            "date": date,
            "recipient_details": recipient_details,       # template expects {{to}}
            "content":" ",             # template expects {{subject}}
            "sender_details": sender_details,      # template expects {{sender}}
            "event": event_name,
            "role": role,
            "title": title,
            "venue": venue,
            "purpose":purpose,
            "name":name1,
            "name2":name2,
        }

        # Prompt for AI body generation
        if doc_type == "letter":
            prompt = (
                f"Generate body content for a formal {doc_type} "
                f"with the following details: Sender: {sender_details}, "
                f"Recipient: {recipient_details}, Purpose: {purpose}, "
                f"Event Details: {event_details}"
                f"dont use **bold** text"
            )
        elif doc_type == "circular":
            prompt = (
                f"Generate body content for a formal circular with the following details: "
                f"event name:{event_name}"
                f"Purpose: {purpose}, Event Details: {event_details}"
                f"dont use **bold** text"
            )
        else:
            prompt = None

        # Use selected template if provided (for notice)
        template_requested = data.get("template") or f"default_templates/{doc_type}_template.docx"

        # Resolve template_requested to an actual file path.
        # Order of resolution:
        # 1. If template_requested is an absolute path or exists as given, use it.
        # 2. backend/uploaded_templates/<template_requested>
        # 3. workspace templates/<template_requested>
        # 4. fallback to template_requested (may raise later)
        template_path = None
        # 1
        if template_requested:
            if os.path.isabs(template_requested) and os.path.exists(template_requested):
                template_path = template_requested
            elif os.path.exists(template_requested):
                template_path = template_requested

        # 2
        backend_uploaded = os.path.join(os.path.dirname(__file__), 'uploaded_templates', template_requested)
        if not template_path and os.path.exists(backend_uploaded):
            template_path = backend_uploaded

        # 3
        workspace_template = os.path.join(os.getcwd(), 'templates', template_requested)
        if not template_path and os.path.exists(workspace_template):
            template_path = workspace_template

        # 4 fallback to requested string (will error later if invalid)
        if not template_path:
            template_path = template_requested

        logger.info(f"Using template: {template_path}")
        
        pdf_buffer = create_document(
            doc_type=doc_type,
            prompt=prompt,
            template_path=template_path,
            placeholders=placeholders,
            doc_id=doc_id
        )

        logger.info(f"Document generated successfully: {doc_id}")
        
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f"document.pdf",
            mimetype="application/pdf"
        )

    except FileNotFoundError as e:
        logger.error(f"Template file not found: {e}")
        return jsonify({"error": f"Template file not found: {str(e)}"}), 400
    
    except ValueError as e:
        # LLM-related errors (invalid output)
        logger.error(f"Validation error: {e}")
        return jsonify({"error": str(e)}), 400
    
    except Exception as e:
        logger.error(f"Document generation failed: {e}", exc_info=True)
        
        # Check if this is an LLM exhaustion error
        if "LLM" in str(e) or "exhausted" in str(e).lower():
            return jsonify({"error": "LLM service unavailable, please retry later"}), 503
        
        return jsonify({"error": str(e)}), 500

# =============================
# Bulk Certificate Upload Endpoint
# =============================
@app.route('/generate-bulk-certificates', methods=['POST'])
def generate_bulk_certificates():
    try:
        logger.info("🔥 /generate-bulk-certificates request received")
        result = process_bulk_certificates()
        logger.info("✅ /generate-bulk-certificates processed successfully")
        return result

    except Exception as e:
        logger.error("❌ /generate-bulk-certificates error", exc_info=True)
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# =============================
# Verification Endpoint
# =============================
@app.route('/verify/<doc_id>')
def verify(doc_id):
    return jsonify(verify_certificate(doc_id))

# =============================
# Login Endpoint
# =============================
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    user = get_user_by_username(username)
    
    if user and check_password_hash(user['password'], password):
        # Generate JWT token
        token = jwt.encode({
            'user_id': str(user['_id']),
            'username': user['username'],
            'role': user['role'],
            'exp': dt.datetime.utcnow() + dt.timedelta(hours=24)  # Token expires in 24 hours
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'role': user['role']
            }
        }), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

# =============================
# Admin Get Users Endpoint
# =============================
@app.route('/admin/create-user', methods=['POST'])
@token_required
def create_user(current_user_id):
    # Check if user is admin
    user = get_user_by_id(current_user_id)
    
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Hash the password
    hashed_password = generate_password_hash(password)
    
    # Create user
    try:
        result = insert_user(username, hashed_password, role)
        if result is None:
            # Duplicate username
            return jsonify({'error': 'Username already exists'}), 409
        return jsonify({'message': 'User created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/users', methods=['GET'])
@token_required
def get_users(current_user_id):
    # Check if user is admin
    user = get_user_by_id(current_user_id)
    
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    # Get all users
    users = get_all_users()
    
    # Convert ObjectId to string for JSON serialization
    users_list = []
    for u in users:
        users_list.append({
            'id': str(u['_id']),
            'username': u['username'],
            'role': u['role'],
            'created_at': u['created_at'].isoformat() if isinstance(u['created_at'], datetime) else str(u['created_at'])
        })
    
    return jsonify({'users': users_list}), 200

# Admin Update User Endpoint
@app.route('/admin/users/<user_id>', methods=['PUT'])
@token_required
def update_user(current_user_id, user_id):
    # Check if user is admin
    user = get_user_by_id(current_user_id)
    
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    username = data.get('username')
    role = data.get('role')
    
    if not username or not role:
        return jsonify({'error': 'Username and role are required'}), 400
    
    # Prevent editing the default admin user
    target_user = get_user_by_id(user_id)
    
    if target_user and target_user['username'] == 'admin':
        return jsonify({'error': 'Cannot edit the default admin user'}), 403
    
    # Update user
    try:
        modified_count = update_user_by_id(user_id, username, role)
        if modified_count == 0:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'message': 'User updated successfully'}), 200
    except DuplicateKeyError:
        return jsonify({'error': 'Username already exists'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admin Delete User Endpoint
@app.route('/admin/users/<user_id>', methods=['DELETE'])
@token_required
def delete_user(current_user_id, user_id):
    # Check if user is admin
    user = get_user_by_id(current_user_id)
    
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    # Prevent deleting the default admin user
    target_user = get_user_by_id(user_id)
    
    if target_user and target_user['username'] == 'admin':
        return jsonify({'error': 'Cannot delete the default admin user'}), 403
    
    # Delete user
    deleted_count = delete_user_by_id(user_id)
    if deleted_count == 0:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'message': 'User deleted successfully'}), 200

# =============================
# Reset Password Endpoint
# =============================
@app.route('/reset-password', methods=['POST'])
@token_required
def reset_password(current_user_id):
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Current password and new password are required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters long'}), 400
    
    # Get current user info
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Verify current password
    if not check_password_hash(user['password'], current_password):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Update password
    hashed_new_password = generate_password_hash(new_password)
    
    try:
        update_user_password(current_user_id, hashed_new_password)
        return jsonify({'message': 'Password reset successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =============================
# Protected Route Example
# =============================
@app.route('/protected', methods=['GET'])
@token_required
def protected_route(current_user_id):
    return jsonify({
        'message': 'This is a protected route',
        'user_id': current_user_id
    }), 200

if __name__ == "__main__":
    # Debug mode only in development
    app.run(
        debug=DEBUG,
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000))
    )
