package storage

import (
	"context"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/rs/zerolog/log"
)

// Specific implementation of the Storage interface for S3
type AzureBolbStorageClient struct {
	Client *azblob.Client
}

func (storageClient *AzureBolbStorageClient) SaveFile(container string, name string, data string) error {
	log.Info().Msgf("Uploading file %s to container %s", name, container)
	_, err := storageClient.Client.UploadBuffer(context.TODO(), container, name, []byte(data), nil)
	if err != nil {
		log.Error().Msgf("failed to save file, %v", err)
		return err
	}

	return nil
}
