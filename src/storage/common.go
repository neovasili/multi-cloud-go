package storage

import (
	"github.com/rs/zerolog/log"
)

import (
	"time"
)

type Storage interface {
	SaveFile(container string, name string, data string) error
}

func Upload(storage Storage, container string, data string) error {
	name := time.Now().Format("2006-01-02T15:04:05") + "-request.json"
	log.Info().Msgf("Uploading file %s to container %s", name, container)
	log.Debug().Msgf("Data: %s", data)
	return storage.SaveFile(container, name, data)
}
