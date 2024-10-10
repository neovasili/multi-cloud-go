package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
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

func HealthCheckHandler(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"message": "OK",
	})
}

func FargateHandler(ctx *gin.Context) {
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
		ctx.JSON(http.StatusOK, string(body))
	}
}

func main() {
	zerolog.TimestampFieldName = "timestamp"
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
	log.Logger = log.With().Caller().Logger()

	app := gin.Default()
	app.POST("/demo", FargateHandler)
	app.GET("/", HealthCheckHandler)
	app.Run(fmt.Sprintf(":%s", constants.ContainerPort))
}
