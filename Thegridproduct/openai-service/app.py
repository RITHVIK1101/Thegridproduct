from flask import Flask, request, jsonify
import openai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route("/process", methods=["POST"])
def process():
    data = request.json.get("text", "")
    if not data:
        return jsonify({"error": "No text provided"}), 400

    try:
        # Call OpenAI API using ChatCompletion
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # or "gpt-4"
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts job-related information."},
                {"role": "user", "content": f"Extract key job-related details from this text: {data}"}
            ],
            max_tokens=100,
            temperature=0.7
        )
        return jsonify({"response": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050)
