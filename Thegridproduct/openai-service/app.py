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

import re
from bson.regex import Regex

@app.route('/search-gigs', methods=['POST'])
def search_gigs():
    try:
        user_input = request.json.get("query")
        if not user_input or len(user_input.strip()) == 0:
            return jsonify({"reply": "Hi! How can I help you today?", "gigs": []})

        # Step 1: Refine the query using OpenAI
        ai_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """
                    Refine the user's query and extract relevant constraints:
                    - Handle vague queries by prompting for more details.
                    - Extract exclusions like 'not tutoring'.
                    - Extract numeric constraints like 'more than $30/hour' or 'around $50'.
                """},
                {"role": "user", "content": user_input}
            ]
        )
        refined_query = ai_response.choices[0].message.content

        # Handle vague queries
        if "please provide more details" in refined_query.lower() or "how can i help" in refined_query.lower():
            return jsonify({
                "reply": "Your query was too vague. Could you clarify what you're looking for in more detail?",
                "gigs": []
            })

        # Step 2: Extract constraints and generate embedding
        exclusions = [term.strip() for term in re.findall(r"not ([\w\s]+)", refined_query.lower())]
        
        # Extract numeric constraints
        price_constraint = re.search(r"(more than|less than|around) \$?(\d+)(?:/hour)?", refined_query.lower())
        query_embedding = get_embedding(refined_query)

        # Step 3: Construct MongoDB query
        mongo_query = {"embedding": {"$exists": True}}
        
        if price_constraint:
            operator, amount = price_constraint.groups()
            amount = int(amount)
            if operator == "more than":
                mongo_query["price"] = {"$regex": Regex(f"\\${amount,}|\\${amount}\\+|{amount,}|{amount}\\+")}
            elif operator == "less than":
                mongo_query["price"] = {"$regex": Regex(f"\\$\\d{{1,{len(str(amount-1))}}}(?:\\.\\d+)?(?:/hour)?")}
            elif operator == "around":
                lower = amount - 5
                upper = amount + 5
                mongo_query["price"] = {"$regex": Regex(f"\\$({lower}|{amount}|{upper})(?:\\.\\d+)?(?:/hour)?")}

        # Filter gigs based on similarity, exclusions, and price constraints
        filtered_gigs = []
        for gig in gigs_collection.find(mongo_query):
            gig_embedding = np.array(gig["embedding"])
            similarity = cosine_similarity([query_embedding], [gig_embedding])[0][0]

            # Exclude gigs with academic/tutoring keywords
            if any(exclusion in gig["category"].lower() or exclusion in gig["description"].lower() for exclusion in exclusions):
                continue

            # Add only if similarity passes the threshold
            if similarity > 0.7:  # Lowered threshold for better recall
                filtered_gigs.append({
                    "id": str(gig["_id"]),
                    "title": gig["title"],
                    "category": gig["category"],
                    "description": gig["description"],
                    "price": gig["price"],
                    "university": gig["university"],
                    "images": gig.get("images", []),
                    "postedDate": gig["postedDate"],
                    "similarity": similarity
                })

        # Deduplicate and sort gigs
        unique_gigs = {gig["id"]: gig for gig in filtered_gigs}
        gigs = sorted(unique_gigs.values(), key=lambda x: x["similarity"], reverse=True)

        # Step 4: Return the response
        return jsonify({
            "reply": refined_query,
            "gigs": gigs[:10]  # Limit to top 10 results
        })

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)