from flask import Flask, request, jsonify
from openai import OpenAI
from pymongo import MongoClient
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re
import os
import logging
from typing import Dict, List, Optional
from datetime import datetime
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask
app = Flask(__name__)
# Ensure we handle proxies correctly
app.wsgi_app = ProxyFix(app.wsgi_app)

# Initialize OpenAI with an optional timeout
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY", "sk-..."),  # Fallback if not set
    timeout=10.0
)

# MongoDB connection with error handling
try:
    mongo_client = MongoClient(os.getenv("MONGODB_URI", "mongodb+srv://..."), serverSelectionTimeoutMS=5000)
    mongo_client.server_info()  # Trigger an exception if we can't connect
    db = mongo_client["gridlyapp"]
    gigs_collection = db["gigs"]
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    raise  # Crash the app if DB is unreachable

def get_embedding(text: str, model: str = "text-embedding-ada-002") -> List[float]:
    """Generate embeddings with error handling."""
    try:
        response = client.embeddings.create(input=text, model=model)
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise

def parse_price_constraints(query: str) -> Dict[str, Optional[float]]:
    """Extract price constraints from the query (min_price, max_price, target_price)."""
    constraints = {
        "min_price": None,
        "max_price": None,
        "target_price": None
    }

    if match := re.search(r"(?:over|more than) \$(\d+)", query.lower()):
        constraints["min_price"] = float(match.group(1))
    if match := re.search(r"less than \$(\d+)", query.lower()):
        constraints["max_price"] = float(match.group(1))
    if match := re.search(r"around \$(\d+)", query.lower()):
        constraints["target_price"] = float(match.group(1))

    return constraints

########################################
# NEW ROOT ROUTE FOR '/' GET & POST
########################################
@app.route("/", methods=["GET", "POST"])
def root_route():
    """
    - GET / : Return a simple greeting
    - POST / : Return "Welcome to the bot"
    """
    if request.method == "GET":
        return "Hello from the Bot Service!"
    elif request.method == "POST":
        return "Welcome to the bot"

########################################
# ADD GIG ENDPOINT
########################################
@app.route('/add-gig', methods=['POST'])
def add_gig():
    """Add a new gig to the database, generating embeddings on the fly."""
    try:
        gig_data = request.json
        if not gig_data:
            return jsonify({"error": "No gig data provided"}), 400

        text = f"{gig_data['title']} {gig_data['description']}"
        embedding = get_embedding(text)

        gig_data["embedding"] = embedding

        # Insert the gig into MongoDB
        result = gigs_collection.insert_one(gig_data)
        return jsonify({"message": "Gig added successfully", "gig_id": str(result.inserted_id)})
    except Exception as e:
        logger.error(f"Error occurred while adding gig: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

########################################
# SEARCH GIGS ENDPOINT
########################################
@app.route('/search-gigs', methods=['POST'])
def search_gigs():
    """Search gigs by user query with GPT-4 refining and vector similarity."""
    start_time = datetime.now()

    try:
        # Validate JSON input
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        # Get the user query
        user_input = request.json.get("query")
        if not user_input or not isinstance(user_input, str):
            return jsonify({"error": "Query parameter is required and must be a string"}), 400

        # Check for casual greetings
        if user_input.lower() in ["hi", "hello", "hey", "howdy", "greetings", "what's up"]:
            return jsonify({
                "reply": "Hi! How can I assist you today?",
                "gigs": [],
                "debug_info": {"query_type": "greeting"}
            })

        # Refine the query with GPT-4
        try:
            ai_response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": """
                    Refine the user's query and extract relevant constraints:
                    - If exclusions like 'not tutoring' are mentioned, include that as exclusions.
                    - Handle vague queries by prompting for more details.
                    - Extract numeric constraints like 'less than $30/hour' or 'over $30'.
                    """},
                    {"role": "user", "content": user_input}
                ]
            )
            refined_query = ai_response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error refining query with GPT-4: {str(e)}")
            refined_query = user_input  # Fallback to original if GPT-4 fails

        # Generate query embedding
        query_embedding = get_embedding(refined_query)

        # Extract price constraints
        price_constraints = parse_price_constraints(refined_query)

        # Perform vector-based search with a max time
        gigs = []
        cursor = gigs_collection.find({"embedding": {"$exists": True}}).max_time_ms(5000)

        for gig in cursor:
            try:
                similarity = cosine_similarity([query_embedding], [gig["embedding"]])[0][0]

                # Attempt to parse numeric price
                raw_price = gig.get("price", "")
                try:
                    gig_price = float(re.search(r"\d+(?:\.\d{1,2})?", raw_price).group())
                except:
                    gig_price = 0.0

                # Price filtering
                if (
                    (price_constraints["min_price"] and gig_price < price_constraints["min_price"]) or
                    (price_constraints["max_price"] and gig_price > price_constraints["max_price"]) or
                    (price_constraints["target_price"] and abs(gig_price - price_constraints["target_price"]) > 10)
                ):
                    continue

                # Similarity threshold
                if similarity > 0.7:
                    gigs.append({
                        "id": str(gig["_id"]),
                        "title": gig["title"],
                        "category": gig["category"],
                        "description": gig["description"],
                        "price": gig["price"],
                        "university": gig["university"],
                        "similarity": float(similarity),
                    })
            except Exception as e:
                logger.error(f"Error processing gig {gig.get('_id')}: {str(e)}", exc_info=True)
                continue

        # Sort by similarity
        gigs_sorted = sorted(gigs, key=lambda x: x["similarity"], reverse=True)
        execution_time = (datetime.now() - start_time).total_seconds()

        return jsonify({
            "reply": refined_query,
            "gigs": gigs_sorted,
            "debug_info": {
                "execution_time": execution_time,
                "total_gigs_matched": len(gigs_sorted),
                "price_constraints": price_constraints,
                "query_refinement": refined_query != user_input
            }
        })

    except Exception as e:
        logger.error(f"Search endpoint error: {str(e)}", exc_info=True)
        return jsonify({
            "error": "An internal server error occurred",
            "debug_info": {
                "error_type": type(e).__name__,
                "error_message": str(e)
            }
        }), 500
