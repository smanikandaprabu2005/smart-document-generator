import os
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from datetime import datetime

# MongoDB configuration (read from environment)
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'documents_db')

# Global MongoDB client
_client = None
_db = None


def get_db_connection():
    """Return a MongoDB database connection using environment configuration."""
    global _client, _db
    
    if _client is None:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        _db = _client[DB_NAME]
    
    return _db


def init_collections():
    """Initialize MongoDB collections with proper indexes."""
    db = get_db_connection()
    
    # Create certificates collection if it doesn't exist
    if 'certificates' not in db.list_collection_names():
        db.create_collection('certificates')
    
    # Create notices collection if it doesn't exist
    if 'notices' not in db.list_collection_names():
        db.create_collection('notices')
    
    # Create users collection if it doesn't exist
    if 'users' not in db.list_collection_names():
        db.create_collection('users')
        # Create unique index on username
        db['users'].create_index('username', unique=True)
    else:
        # Ensure unique index exists
        if 'username_1' not in db['users'].index_information():
            db['users'].create_index('username', unique=True)


def init_notice_table():
    """Initialize notice collection (kept for compatibility)."""
    init_collections()


def store_notice(doc_id, title, name1, name2, date, venue, template):
    """Store notice information in MongoDB."""
    db = get_db_connection()
    
    notice_doc = {
        '_id': doc_id,
        'title': title,
        'name1': name1,
        'name2': name2,
        'date': date,
        'venue': venue,
        'template': template,
        'created_at': datetime.now()
    }
    
    db['notices'].insert_one(notice_doc)


def store_certificate(doc_id, recipient_name, event_name, date, role, doc_type):
    """Store certificate information in MongoDB."""
    db = get_db_connection()
    
    certificate_doc = {
        '_id': doc_id,
        'recipient_name': recipient_name,
        'event_name': event_name,
        'date': date,
        'role': role,
        'doc_type': doc_type,
        'created_at': datetime.now()
    }
    
    db['certificates'].insert_one(certificate_doc)


def get_user_by_username(username):
    """Get user by username from MongoDB."""
    db = get_db_connection()
    return db['users'].find_one({'username': username})


def insert_user(username, password, role='user'):
    """Insert a new user into MongoDB. Returns inserted_id on success, None on duplicate."""
    db = get_db_connection()
    
    user_doc = {
        'username': username,
        'password': password,
        'role': role,
        'created_at': datetime.now()
    }
    
    try:
        result = db['users'].insert_one(user_doc)
        return result.inserted_id
    except DuplicateKeyError:
        # Username already exists
        return None


def get_user_by_id(user_id):
    """Get user by ID from MongoDB."""
    db = get_db_connection()
    from bson import ObjectId
    
    try:
        return db['users'].find_one({'_id': ObjectId(user_id)})
    except:
        return None


def get_all_users():
    """Get all users from MongoDB, sorted by creation date."""
    db = get_db_connection()
    return list(db['users'].find().sort('created_at', -1))


def update_user_by_id(user_id, username=None, role=None):
    """Update user by ID in MongoDB."""
    db = get_db_connection()
    from bson import ObjectId
    
    update_doc = {}
    if username is not None:
        update_doc['username'] = username
    if role is not None:
        update_doc['role'] = role
    
    if not update_doc:
        return 0
    
    result = db['users'].update_one(
        {'_id': ObjectId(user_id)},
        {'$set': update_doc}
    )
    return result.modified_count


def delete_user_by_id(user_id):
    """Delete user by ID from MongoDB."""
    db = get_db_connection()
    from bson import ObjectId
    
    result = db['users'].delete_one({'_id': ObjectId(user_id)})
    return result.deleted_count


def update_user_password(user_id, new_password):
    """Update user password in MongoDB."""
    db = get_db_connection()
    from bson import ObjectId
    
    result = db['users'].update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'password': new_password}}
    )
    return result.modified_count


def get_certificate_by_id(doc_id):
    """Get certificate by ID from MongoDB."""
    db = get_db_connection()
    return db['certificates'].find_one({'_id': doc_id})


def user_exists(username):
    """Check if user exists in MongoDB."""
    db = get_db_connection()
    return db['users'].find_one({'username': username}) is not None


def close_connection():
    """Close MongoDB connection."""
    global _client
    if _client:
        _client.close()
        _client = None