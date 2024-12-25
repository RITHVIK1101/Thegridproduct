from flask import Flask, request, jsonify
from openai import OpenAI
from pymongo import MongoClient
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re
import os
import logging
from typing import Dict, List, Optional, Union
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask and OpenAI
app = Flask(__name__)
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))  # Move API key to environment variable

# MongoDB connection with error handling
try:
    mongo_client = MongoClient(os.getenv('MONGODB_URI'), serverSelectionTimeoutMS=5000)
    mongo_client.server_info()  # Will throw an exception if connection fails
    db = mongo_client["gridlyapp"]
    gigs_collection = db["gigs"]
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    raise

def get_embedding(text: str, model: str = "text-embedding-ada-002") -> List[float]:
    """Generate embeddings with error handling and retries."""
    try:
        response = client.embeddings.create(input=text, model=model)
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise

def parse_price_constraints(query: str) -> Dict[str, Optional[float]]:
    """Extract price constraints from the query."""
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

@app.route('/search-gigs', methods=['POST'])
def search_gigs():
    """Enhanced search endpoint with better error handling and logging."""
    start_time = datetime.now()
    
    try:
        # Validate input
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400
            
        user_input = request.json.get("query")
        if not user_input or not isinstance(user_input, str):
            return jsonify({"error": "Query parameter is required and must be a string"}), 400

        # Handle casual greetings
        if user_input.lower() in ["hi", "hello", "hey", "howdy", "greetings", "what's up"]:
            return jsonify({
                "reply": "Hi! How can I assist you today?",
                "gigs": [],
                "debug_info": {"query_type": "greeting"}
            })

        # Refine query with GPT-4
        try:
            ai_response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Refine the user's query and extract relevant constraints."},
                    {"role": "user", "content": user_input}
                ]
            )
            refined_query = ai_response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error refining query with GPT-4: {str(e)}")
            refined_query = user_input  # Fallback to original query

        # Get embeddings and search
        query_embedding = get_embedding(refined_query)
        price_constraints = parse_price_constraints(refined_query)
        
        # Perform search with timeout
        gigs = []
        cursor = gigs_collection.find({"embedding": {"$exists": True}}).max_time_ms(5000)
        
        for gig in cursor:
            try:
                similarity = cosine_similarity([query_embedding], [gig["embedding"]])[0][0]
                
                # Price filtering
                gig_price = float(re.search(r"\d+(?:\.\d{2})?", gig.get("price", "0")).group())
                
                if ((price_constraints["min_price"] and gig_price < price_constraints["min_price"]) or
                    (price_constraints["max_price"] and gig_price > price_constraints["max_price"]) or
                    (price_constraints["target_price"] and abs(gig_price - price_constraints["target_price"]) > 10)):
                    continue

                if similarity > 0.7:
                    gigs.append({
                        "id": str(gig["_id"]),
                        "title": gig["title"],
                        "category": gig["category"],
                        "description": gig["description"],
                        "price": gig["price"],
                        "university": gig["university"],
                        "similarity": float(similarity)
                    })
            except Exception as e:
                logger.error(f"Error processing gig {gig.get('_id')}: {str(e)}")
                continue

        execution_time = (datetime.now() - start_time).total_seconds()
        
        return jsonify({
            "reply": refined_query,
            "gigs": sorted(gigs, key=lambda x: x["similarity"], reverse=True),
            "debug_info": {
                "execution_time": execution_time,
                "total_gigs": len(gigs),
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

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)