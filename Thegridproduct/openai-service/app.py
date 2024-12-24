from flask import Flask, request, jsonify
from openai import OpenAI
from pymongo import MongoClient
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np  # For embedding handling
import re  # For keyword escaping

# Initialize Flask and OpenAI
app = Flask(__name__)
client = OpenAI(api_key="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")

# MongoDB connection
mongo_client = MongoClient("mongodb+srv://rithviksaba:BFoIjfRj3rN6zfd4@db.hzf98.mongodb.net/?retryWrites=true&w=majority")  # Replace with your MongoDB URI
db = mongo_client["gridlyapp"]
gigs_collection = db["gigs"]

# Function to generate embeddings
def get_embedding(text, model="text-embedding-ada-002"):
    response = client.embeddings.create(input=text, model=model)
    return response.data[0].embedding

# Endpoint to add a gig
@app.route('/add-gig', methods=['POST'])
def add_gig():
    try:
        # Get gig data from the request
        gig_data = request.json
        if not gig_data:
            return jsonify({"error": "No gig data provided"}), 400

        # Generate embedding for the gig
        text = f"{gig_data['title']} {gig_data['description']}"
        embedding = get_embedding(text)

        # Add the embedding to the gig data
        gig_data["embedding"] = embedding

        # Insert the gig into the database
        result = gigs_collection.insert_one(gig_data)

        return jsonify({"message": "Gig added successfully", "gig_id": str(result.inserted_id)})

    except Exception as e:
        print("Error occurred while adding gig:", e)
        return jsonify({"error": str(e)}), 500
@app.route('/search-gigs', methods=['POST'])
def search_gigs():
    try:
        user_input = request.json.get("query")
        if not user_input or len(user_input.strip()) == 0:
            return jsonify({"reply": "Hi! How can I help you today?", "gigs": [], "debug_info": {}})

        # Step 1: Check for casual greetings
        casual_greetings = ["hi", "hello", "hey", "howdy", "greetings", "what's up"]
        if user_input.lower() in casual_greetings:
            return jsonify({
                "reply": "Hi! How can I assist you today?",
                "gigs": [],
                "debug_info": {}
            })

        # Step 2: Refine the query
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

        # Step 3: Extract constraints
        exclusions = []
        price_min, price_max, price_range = None, None, None

        # Parse exclusions
        if "not " in refined_query.lower():
            exclusions = [term.strip() for term in re.findall(r"not ([\w\s]+)", refined_query.lower())]

        # Improved price parsing logic
        if "over $" in refined_query.lower() or "more than $" in refined_query.lower():
            match = re.search(r"(?:over|more than) \$(\d+)", refined_query.lower())
            if match:
                price_min = float(match.group(1))
        
        if "less than $" in refined_query.lower():
            match = re.search(r"less than \$(\d+)", refined_query.lower())
            if match:
                price_max = float(match.group(1))
        
        if "around $" in refined_query.lower():
            match = re.search(r"around \$(\d+)", refined_query.lower())
            if match:
                price_range = float(match.group(1))
        # Step 3: Generate query embedding
        query_embedding = get_embedding(refined_query)

        # Step 4: Perform vector-based search
        gigs = []
        for gig in gigs_collection.find({"embedding": {"$exists": True}}):
            gig_embedding = np.array(gig["embedding"])
            similarity = cosine_similarity([query_embedding], [gig_embedding])[0][0]

            # Extract gig price
            try:
                raw_price = gig.get("price", "")
                gig_price = float(re.search(r"\d+(?:\.\d{2})?", raw_price).group()) if raw_price else 0
            except (ValueError, AttributeError):
                gig_price = 0

            # Apply price filtering
            if price_min and gig_price < price_min:
                continue
            if price_max and gig_price > price_max:
                continue
            if price_range and abs(gig_price - price_range) > 10:  # +/- $10 range
                continue

            # Apply exclusions
            if any(exclusion in gig["category"].lower() or exclusion in gig["description"].lower() for exclusion in exclusions):
                continue

            if similarity > 0.7:  # Similarity threshold
                gigs.append({
                    "id": str(gig["_id"]),
                    "title": gig["title"],
                    "category": gig["category"],
                    "description": gig["description"],
                    "price": gig["price"],
                    "university": gig["university"],
                    "images": gig["images"],
                    "postedDate": gig["postedDate"],
                    "similarity": similarity
                })

        # Sort results
        gigs = sorted(gigs, key=lambda x: x["similarity"], reverse=True)

        return jsonify({
            "reply": refined_query,
            "gigs": gigs,
            "debug_info": {
                "total_gigs": gigs_collection.count_documents({}),
                "matching_gigs_count": len(gigs),
                "exclusions": exclusions,
                "price_min": price_min,
                "price_max": price_max,
                "price_range": price_range,
                "similarity_threshold": 0.7
            }
        })

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
