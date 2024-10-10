package storage

import (
	"bytes"
	"context"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/rs/zerolog/log"
)

// Specific implementation of the Storage interface for S3
type S3StorageClient struct {
	Client *s3.Client
}

func (storageClient *S3StorageClient) SaveFile(container string, name string, data string) error {
	_, err := storageClient.Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: &container,
		Key:    &name,
		Body:   bytes.NewReader([]byte(data)),
	})

	if err != nil {
		log.Error().Msgf("failed to save file, %v", err)
		return err
	}

	return nil
}
