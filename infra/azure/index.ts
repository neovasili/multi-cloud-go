import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as azure from "@pulumi/azure-native";
import * as web from "@pulumi/azure-native/web";
import * as storage from "@pulumi/azure-native/storage";

function getConnectionString(
  resourceGroupName: pulumi.Input<string>,
  accountName: pulumi.Input<string>,
): pulumi.Output<string> {
  // Retrieve the primary storage account key.
  const storageAccountKeys = storage.listStorageAccountKeysOutput({
    resourceGroupName,
    accountName,
  });
  const primaryStorageKey = storageAccountKeys.keys[0].value;

  // Build the connection string to the storage account.
  return pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${primaryStorageKey}`;
}

function getConnectionFileString(
  resourceGroupName: pulumi.Input<string>,
  accountName: pulumi.Input<string>,
): pulumi.Output<string> {
  // Retrieve the primary storage account key.
  const storageAccountKeys = storage.listStorageAccountKeysOutput({
    resourceGroupName,
    accountName,
  });
  const primaryStorageKey = storageAccountKeys.keys[0].value;

  // Build the connection string to the storage account.
  return pulumi.interpolate`DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=${accountName};AccountKey=${primaryStorageKey}`;
}

function signedBlobReadUrl(
  blob: storage.Blob,
  container: storage.BlobContainer,
  account: storage.StorageAccount,
  resourceGroup: resources.ResourceGroup,
): pulumi.Output<string> {
  const blobSAS = storage.listStorageAccountServiceSASOutput({
    accountName: account.name,
    protocols: storage.HttpProtocol.Https,
    sharedAccessExpiryTime: "2030-01-01",
    sharedAccessStartTime: "2021-01-01",
    resourceGroupName: resourceGroup.name,
    resource: storage.SignedResource.C,
    permissions: storage.Permissions.R,
    canonicalizedResource: pulumi.interpolate`/blob/${account.name}/${container.name}`,
    contentType: "application/json",
    cacheControl: "max-age=5",
    contentDisposition: "inline",
    contentEncoding: "deflate",
  });
  return pulumi.interpolate`https://${account.name}.blob.core.windows.net/${container.name}/${blob.name}?${blobSAS.serviceSasToken}`;
}

// Create an Azure Resource Group
const resourceGroup = new resources.ResourceGroup("resourceGroup");

// Create an Azure resource (Storage Account)
const storageAccount = new storage.StorageAccount(
  "sa",
  {
    accountName: "multicloudgodemo",
    resourceGroupName: resourceGroup.name,
    sku: {
      name: storage.SkuName.Standard_LRS,
    },
    kind: storage.Kind.StorageV2,
  },
  {
    retainOnDelete: false,
  },
);

// Export the primary key of the Storage Account
const storageAccountKeys = storage.listStorageAccountKeysOutput({
  resourceGroupName: resourceGroup.name,
  accountName: storageAccount.name,
});

export const primaryStorageKey = storageAccountKeys.keys[0].value;

// Function code archives will be stored in this container.
const codeContainer = new storage.BlobContainer("zips", {
  resourceGroupName: resourceGroup.name,
  accountName: storageAccount.name,
});

// Upload Azure Function's code as a zip archive to the storage account.
const codeBlob = new storage.Blob("zip", {
  resourceGroupName: resourceGroup.name,
  accountName: storageAccount.name,
  containerName: codeContainer.name,
  source: new pulumi.asset.FileArchive("../../bin/azure-function.zip"),
});

const plan = new azure.web.AppServicePlan("MultiCloudGoPlan", {
  elasticScaleEnabled: false,
  kind: "functionapp",
  location: "West Europe",
  maximumElasticWorkerCount: 1,
  name: "MultiCloudGoPlan",
  perSiteScaling: false,
  reserved: true,
  resourceGroupName: resourceGroup.name,
  sku: {
      capacity: 0,
      name: "Y1",
      tier: "Dynamic",
  },
  targetWorkerCount: 0,
  targetWorkerSizeId: 0,
  zoneRedundant: false,
});

// Build the connection string and zip archive's SAS URL. They will go to Function App's settings.
const storageConnectionString = getConnectionString(
  resourceGroup.name,
  storageAccount.name,
);
const storageFileConnectionString = getConnectionFileString(
  resourceGroup.name,
  storageAccount.name,
);
const codeBlobUrl = signedBlobReadUrl(
  codeBlob,
  codeContainer,
  storageAccount,
  resourceGroup,
);

// Create the Function App.
const app = new azure.web.WebApp("MultiCloudGo", {
  enabled: true,
  identity: {
    type: azure.web.ManagedServiceIdentityType.SystemAssigned,
  },
  // TODO: understand how to attach a role to the identity
  keyVaultReferenceIdentity: azure.web.ManagedServiceIdentityType.SystemAssigned,
  kind: "functionapp,linux",
  location: "West Europe",
  name: "MultiCloudGo",
  redundancyMode: azure.web.RedundancyMode.None,
  reserved: true,
  resourceGroupName: resourceGroup.name,
  serverFarmId: plan.id,
  siteConfig: {
    appSettings: [
      { name: "SCALE_CONTROLLER_LOGGING_ENABLED", value: "AppInsights:Verbose" },
      { name: "FUNCTIONS_WORKER_RUNTIME", value: "custom" },
      { name: "WEBSITE_RUN_FROM_PACKAGE", value: codeBlobUrl },
      { name: "AzureWebJobsStorage", value: storageConnectionString },
      { name: "FUNCTIONS_EXTENSION_VERSION", value: "~4" },
      { name: "STORAGE_CONTAINER", value: "multi-cloud-go-demo" },
      {
        name: "APPLICATIONINSIGHTS_CONNECTION_STRING",
        value: "InstrumentationKey=e22b449a-5261-48fd-b414-f68b000ccfab;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/;LiveEndpoint=https://westeurope.livediagnostics.monitor.azure.com/;ApplicationId=8eff9d21-1c5f-438f-a795-ea1afbf0d88f",
      },
      {
        name: "WEBSITE_CONTENTAZUREFILECONNECTIONSTRING",
        value: storageFileConnectionString,
      },
      {
        name: "WEBSITE_CONTENTSHARE",
        value: "sampleazureappnew0c9ab85f729a",
      },
      {
        name: "WEBSITE_MOUNT_ENABLED",
        value: "1",
      },
    ],
    alwaysOn: false,
    autoHealEnabled: false,
    detailedErrorLoggingEnabled: false,
    functionAppScaleLimit: 200,
    functionsRuntimeScaleMonitoringEnabled: false,
    http20Enabled: true,
    httpLoggingEnabled: false,
    loadBalancing: azure.web.SiteLoadBalancing.LeastRequests,
    managedPipelineMode: azure.web.ManagedPipelineMode.Integrated,
    minTlsVersion: azure.web.SupportedTlsVersions.SupportedTlsVersions_1_2,
    minimumElasticInstanceCount: 0,
    netFrameworkVersion: "v4.0",
    numberOfWorkers: 1,
    remoteDebuggingEnabled: false,
    requestTracingEnabled: false,
    scmMinTlsVersion: azure.web.SupportedTlsVersions.SupportedTlsVersions_1_2,
    scmType: azure.web.ScmType.None,
  },
});

export const endpoint = pulumi.interpolate`https://${app.defaultHostName}/api/demo`;
