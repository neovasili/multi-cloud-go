# For local testing purposes, remember to replace the account number with your own
ECR_REPO="136722809816.dkr.ecr.eu-west-1.amazonaws.com/multi-cloud-go-demo"

dependencies-go:
	@echo "Installing go dependencies"
	@go mod download

clean-lambda:
	@echo "Cleaning lambda function"
	@rm -rf bin/bootstrap
	@rm -rf bin/lambda.zip

build-lambda: dependencies-go clean-lambda
	@echo "Building lambda function"
	@GOOS=linux go build -o bin/bootstrap src/entrypoints/lambda/main.go
	@zip -j bin/lambda.zip bin/bootstrap

clean-fargate:
	@echo "Cleaning fargate"
	@rm -rf bin/fargate

build-fargate: dependencies-go clean-fargate
	@echo "Building fargate binary"
	@GOOS=linux go build -o bin/fargate src/entrypoints/ecs-fargate/main.go
	@chmod +x bin/fargate

build-fargate-docker: build-fargate
	@docker buildx build -f src/entrypoints/ecs-fargate/Dockerfile . -t ${ECR_REPO}:latest
