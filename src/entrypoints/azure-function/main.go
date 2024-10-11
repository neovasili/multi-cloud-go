package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"encoding/json"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/neovasili/multi-cloud-go/src/common/constants"
	"github.com/neovasili/multi-cloud-go/src/storage"
)

var storageClient *storage.AzureBolbStorageClient
var storageContainer = os.Getenv("STORAGE_CONTAINER")

func getPort() string {
	port := "8080"
	// The FUNCTIONS_CUSTOMHANDLER_PORT is essential for Azure Functions to work properly. 
	if value, ok := os.LookupEnv("FUNCTIONS_CUSTOMHANDLER_PORT"); ok {
		port = value
	}
	return port
}

func init() {
	// Create a new service client with token credential
	credential, err := azidentity.NewDefaultAzureCredential(nil)
	if err != nil {
		log.Fatal().Msgf("failed to load SDK configuration, %v", err)
	}
	
	client, err := azblob.NewClient(constants.AzureBlobStorageAccountUrl, credential, nil)
	if err != nil {
		log.Fatal().Msgf("failed to load SDK configuration, %v", err)
	}

	// Initialize Azure Blob storage client
	storageClient = &storage.AzureBolbStorageClient{Client: client}
}

func HealthCheckHandler(ctx *gin.Context) {
	for key, value := range constants.CorsHeaders {
		ctx.Writer.Header().Set(key, value)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "OK",
	})
}

func AzureFunctionHandler(ctx *gin.Context) {
	for key, value := range constants.CorsHeaders {
		ctx.Writer.Header().Set(key, value)
	}

	event := ctx.Request
	if event == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "Bad Request",
		})
	}
	log.Debug().Msgf("Received event: %+v", event)

	body, err := io.ReadAll(event.Body)
	if err != nil {
		log.Error().Msgf("failed to read body, %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to fetch data",
		})
	}

	err = storage.Upload(storageClient, storageContainer, string(body))
	if err != nil {
		log.Error().Msgf("failed to upload file, %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to fetch data",
		})
	}
	
	if err == nil {
		var response map[string]interface{}
		err = json.Unmarshal(body, &response)
		if err != nil {
			log.Error().Msgf("failed to unmarshal body, %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"message": "Failed to parse response",
			})
		}
		ctx.JSON(http.StatusOK, response)
	}
}

func main() {
	zerolog.TimestampFieldName = "timestamp"
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	log.Logger = log.With().Caller().Logger()

	port := getPort()

	app := gin.Default()
	app.POST("/api/demo", AzureFunctionHandler)
	app.Run(fmt.Sprintf(":%s", port))
}
