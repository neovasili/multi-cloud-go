import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as apigateway from "@pulumi/aws-apigateway";
import * as awsx from "@pulumi/awsx";

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.BucketV2("multi-cloud-go-demo", {
  bucket: "multi-cloud-go-demo",
  forceDestroy: true,
}, {
  retainOnDelete: false,
});

// Export the name of the bucket
export const bucketName = bucket.id;

const lambdaRole = new aws.iam.Role("lambda-role", {
  name: "lambda-role",
  description: "Role for Lambda to access S3",
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Action: "sts:AssumeRole",
      Effect: "Allow",
      Principal: {
        Service: "lambda.amazonaws.com",
      },
    }],
  }),
  managedPolicyArns: [
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    "arn:aws:iam::aws:policy/AmazonS3FullAccess",  // Let's be lazy and give full access to S3
    "arn:aws:iam::aws:policy/AWSXrayFullAccess" // tracing permissions
  ],
}, {
  retainOnDelete: false,
});

const lambdaLogGroup = new aws.cloudwatch.LogGroup("multi-cloud-go-demo", {
  name: "/aws/lambda/multi-cloud-go-demo",
  retentionInDays: 7,
}, {
  retainOnDelete: false,
});

const lambdaFunction = new aws.lambda.Function("multi-cloud-go-demo", {
  name: "multi-cloud-go-demo",
  description: "A simple Go Lambda function",
  role: lambdaRole.arn,
  handler: "bootstrap",
  runtime: aws.lambda.Runtime.CustomAL2023,
  architectures: ["arm64"],
  code: new pulumi.asset.FileArchive("../../bin/lambda.zip"),
  environment: {
    variables: {
      STORAGE_CONTAINER: bucket.bucket,
    },
  },
  tracingConfig: {
    mode: "Active",
  },
  memorySize: 128,
  timeout: 5,
  loggingConfig: {
    logGroup: lambdaLogGroup.name,
    logFormat: "JSON",
    applicationLogLevel: "INFO",
    systemLogLevel: "WARN",
  },
}, {
  retainOnDelete: false,
});

const api = new apigateway.RestAPI("multi-cloud-go-demo", {
  stageName: "dev",
  description: "A simple API Gateway for the Go Lambda function",
  routes: [{
    path: "/demo",
    method: "POST",
    eventHandler: lambdaFunction,
  }],
}, {
  retainOnDelete: false,
  dependsOn: [lambdaFunction],
});

export const apiUrl = api.url;

const fargateEcrRepo = new awsx.ecr.Repository("multi-cloud-go-demo", {
  name: "multi-cloud-go-demo",
  forceDelete: true,
}, {
  retainOnDelete: false,
});

export const ecrRepoUrl = fargateEcrRepo.url;

const image = new awsx.ecr.Image("image", {
  repositoryUrl: fargateEcrRepo.url,
  context: "../../",
  platform: "linux/arm64",
  dockerfile: "../../src/entrypoints/ecs-fargate/Dockerfile",
  imageTag: "latest",
});

const lb = new awsx.lb.ApplicationLoadBalancer("loadBalancer");
const cluster = new aws.ecs.Cluster("cluster");

const service = new awsx.ecs.FargateService("service", {
    cluster: cluster.arn,
    assignPublicIp: true,
    desiredCount: 2,
    taskDefinitionArgs: {
      container: {
        name: "my-service",
        image: image.imageUri,
        environment: [
          { name: "STORAGE_CONTAINER", value: bucket.bucket },
        ],
        cpu: 128,
        memory: 512,
        essential: true,
        portMappings: [
          {
            containerPort: 80,
            targetGroup: lb.defaultTargetGroup,
          },
        ],
      },
      runtimePlatform: {
        operatingSystemFamily: "LINUX",
        cpuArchitecture: "ARM64",
      },
    },
});

export const fargateUrl = pulumi.interpolate`http://${lb.loadBalancer.dnsName}:8080/demo`;
