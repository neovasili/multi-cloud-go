package constants

import (
	"github.com/aws/aws-lambda-go/events"
)

var CorsHeaders = map[string]string{
	"Access-Control-Allow-Origin":  "*",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "POST",
}

var Error500Response = &events.APIGatewayProxyResponse{
	StatusCode: 500,
	Headers:    CorsHeaders,
	Body:       "Failed to fetch data",
}

const (
	ContainerPort = "80"
)
