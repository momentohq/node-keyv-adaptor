import { v4 } from "uuid";
import { CacheClientProps } from "@gomomento/sdk/dist/src/cache-client-props";
import {
  CreateCache,
  Configurations,
  DeleteCache,
  MomentoErrorCode,
  CacheClient,
  CredentialProvider,
} from "@gomomento/sdk";
import KeyvMomento from "../src";

export function testCacheName(): string {
  const name = process.env.CACHE_NAME!;
  return name + v4();
}

const deleteCacheIfExists = async (momento: CacheClient, cacheName: string) => {
  const deleteResponse = await momento.deleteCache(cacheName);
  if (deleteResponse instanceof DeleteCache.Error) {
    if (deleteResponse.errorCode() !== MomentoErrorCode.NOT_FOUND_ERROR) {
      throw deleteResponse.innerException();
    }
  }
};

function momentoClientForTesting() {
  const IntegrationTestCacheClientProps: CacheClientProps = {
    configuration: Configurations.Laptop.latest(),
    credentialProvider: CredentialProvider.fromEnvironmentVariable({
      environmentVariableName: "MOMENTO_AUTH_TOKEN",
    }),
    defaultTtlSeconds: 60,
  };
  return new CacheClient(IntegrationTestCacheClientProps);
}

export function SetupIntegrationTest(): {
  client: KeyvMomento;
} {
  return setupIntegrationTestWithMomento();
}

function setupIntegrationTestWithMomento() {
  const cacheName = testCacheName();

  beforeAll(async () => {
    // Use a fresh client to avoid test interference with setup.
    const momento = momentoClientForTesting();
    await deleteCacheIfExists(momento, cacheName);
    const createResponse = await momento.createCache(cacheName);
    if (createResponse instanceof CreateCache.Error) {
      throw createResponse.innerException();
    }
  });

  afterAll(async () => {
    // Use a fresh client to avoid test interference with teardown.
    const momento = momentoClientForTesting();
    const deleteResponse = await momento.deleteCache(cacheName);
    if (deleteResponse instanceof DeleteCache.Error) {
      throw deleteResponse.innerException();
    }
  });

  const momentoClient = momentoClientForTesting();
  const momentoNodeRedisClient = new KeyvMomento(momentoClient, cacheName);

  return { client: momentoNodeRedisClient };
}
