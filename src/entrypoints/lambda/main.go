package main

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/neovasili/multi-cloud-go/src/common/constants"
	"github.com/neovasili/multi-cloud-go/src/storage"
)

var storageClient *storage.S3StorageClient
var storageContainer = os.Getenv("STORAGE_CONTAINER")

func init() {
	// Load the SDK configuration
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatal().Msgf("failed to load SDK configuration, %v", err)
	}

	// Initialize S3 storage client
	storageClient = &storage.S3StorageClient{Client: s3.NewFromConfig(cfg)}
}

func LambdaHandler(ctx context.Context, event *events.APIGatewayProxyRequest) (*events.APIGatewayProxyResponse, error) {
	if event == nil {
		return &events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    constants.CorsHeaders,
			Body:       "Bad Request",
		}, nil
	}
	log.Debug().Msgf("Received event: %+v", event)

	err := storage.Upload(storageClient, storageContainer, event.Body)
	if err != nil {
		log.Error().Msgf("failed to upload file, %v", err)
		return constants.Error500Response, nil
	}

	return &events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers:    constants.CorsHeaders,
		Body:       string(event.Body),
	}, nil
}

func main() {
	zerolog.TimestampFieldName = "timestamp"
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
	log.Logger = log.With().Caller().Logger()

	lambda.Start(LambdaHandler)
}
