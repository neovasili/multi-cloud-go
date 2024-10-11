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

clean-azure-function:
	@echo "Cleaning azure-function function"
	@rm -rf bin/handler
	@rm -rf bin/azure-function.zip
	@rm -rf bin/host.json
	@rm -rf bin/local.settings.json
	@rm -rf bin/multi-cloud-go

build-azure-function: dependencies-go clean-azure-function
	@echo "Building azure-function function"
	@GOOS=linux GOARCH=amd64 go build -o bin/handler src/entrypoints/azure-function/main.go
	@cp src/entrypoints/azure-function/host.json bin/host.json
	@cp src/entrypoints/azure-function/local.settings.json bin/local.settings.json
	@cp -R src/entrypoints/azure-function/multi-cloud-go/ bin/multi-cloud-go/
	@cd bin && zip -r azure-function.zip handler host.json local.settings.json multi-cloud-go/

build-azure-function-local: dependencies-go clean-azure-function
	@echo "Building azure-function function"
	@GOOS=darwin GOARCH=arm64 go build -o bin/handler src/entrypoints/azure-function/main.go
	@cp src/entrypoints/azure-function/host.json bin/host.json
	@cp src/entrypoints/azure-function/local.settings.json bin/local.settings.json
	@cp -R src/entrypoints/azure-function/multi-cloud-go/ bin/multi-cloud-go/
	@cd bin && zip -r azure-function.zip handler host.json local.settings.json multi-cloud-go/
