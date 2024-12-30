package embeddings

import (
	"context"
	"fmt"
	"os"

	openai "github.com/sashabaranov/go-openai"
)

func GetEmbeddingForText(ctx context.Context, text string) ([]float32, error) {
	// Initialize the OpenAI client
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("missing OPENAI_API_KEY environment variable")
	}

	client := openai.NewClient(apiKey)

	// Call the embeddings API
	resp, err := client.CreateEmbeddings(ctx, openai.EmbeddingRequest{
		Model: openai.AdaEmbeddingV2, // or "text-embedding-ada-002" for the standard embedding model
		Input: []string{text},        // You can pass multiple strings if you like
	})
	if err != nil {
		return nil, err
	}

	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("no embedding returned by OpenAI")
	}

	// resp.Data[0].Embedding is []float32
	return resp.Data[0].Embedding, nil
}
