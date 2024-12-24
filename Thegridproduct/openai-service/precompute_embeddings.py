from openai import OpenAI
from pymongo import MongoClient

# Initialize the OpenAI client
client = OpenAI(api_key="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")

# MongoDB connection
mongo_client = MongoClient("mongodb+srv://rithviksaba:BFoIjfRj3rN6zfd4@db.hzf98.mongodb.net/?retryWrites=true&w=majority")
db = mongo_client["gridlyapp"]
gigs_collection = db["gigs"]

def get_embedding(text, model="text-embedding-ada-002"):
    response = client.embeddings.create(input=text, model=model)
    return response.data[0].embedding

def compute_embeddings():
    for gig in gigs_collection.find({"embedding": {"$exists": False}}):
        text = f"{gig['title']} {gig['description']}"
        embedding = get_embedding(text)
        
        gigs_collection.update_one(
            {"_id": gig["_id"]},
            {"$set": {"embedding": embedding}}
        )
        print(f"Computed and stored embedding for gig: {gig['title']}")

if __name__ == "__main__":
    compute_embeddings()
