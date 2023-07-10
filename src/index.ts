import EventEmitter from 'node:events';
import Keyv, {Store, StoredData} from 'keyv';
import {
  CacheClient,
  CacheDelete,
  CacheFlush,
  CacheGet,
  CacheItemGetTtl,
  CacheSet,
} from '@gomomento/sdk';

type KeyvMomentoOptions<Value> = NonNullable<unknown> & Keyv.Options<Value>;

/**
 * KeyValueCacheSetOptions exported to match with apollo graphql set options
 * defined here:
 *   https://github.com/apollographql/apollo-utils/blob/main/packages/keyValueCache/src/KeyValueCache.ts
 */
interface KeyValueCacheSetOptions {
  /**
   * Specified in **seconds**, the time-to-live (TTL) value limits the lifespan
   * of the data being stored in the cache.
   */
  ttl?: number | null;
}

class KeyvMomento<Value = any> extends EventEmitter implements Store<Value> {
  namespace?: string;
  ttlSupport = true;
  client: CacheClient;
  cacheName: string;
  opts: KeyvMomentoOptions<Value>;

  constructor(
    client: CacheClient,
    cacheName: string,
    options?: KeyvMomentoOptions<Value>
  ) {
    super();

    this.opts = {
      ...options,
    };
    this.client = client;
    this.cacheName = cacheName;
  }

  async get(key: string): Promise<Value | undefined> {
    const rsp = await this.client.get(this.cacheName, key);
    if (rsp instanceof CacheGet.Hit) {
      return rsp.valueString() as Value;
    } else if (rsp instanceof CacheGet.Error) {
      this.emit('error', rsp.message());
    }
    return undefined;
  }

  getMany(keys: string[]): Promise<Array<StoredData<Value>>> {
    const promises = [];
    for (const key of keys) {
      promises.push(this.get(key));
    }

    return Promise.allSettled(promises).then(values => {
      const data: Array<StoredData<Value>> = [];
      for (const value of values) {
        // @ts-expect-error - value is an object
        data.push(value.value as StoredData<Value>);
      }

      return data;
    });
  }

  async set(
    key: string,
    value: Value,
    options?: number | KeyValueCacheSetOptions
  ) {
    const momentoSetOptions: {ttl?: number} = {};

    if (options !== undefined) {
      if (typeof options === 'number') {
        momentoSetOptions.ttl = Math.floor(options / 1000); // Moving to seconds
      } else {
        if (options.ttl) {
          momentoSetOptions.ttl = options.ttl;
        }
      }
    }

    const rsp = await this.client.set(
      this.cacheName,
      key,
      // @ts-expect-error - Value needs to be number, string or buffer
      value,
      options
    );
    if (rsp instanceof CacheSet.Error) {
      this.emit('error', rsp.message());
    }
  }

  async delete(key: string): Promise<boolean> {
    const rsp = await this.client.delete(this.cacheName, key);
    if (rsp instanceof CacheDelete.Error) {
      this.emit('error', rsp.message());
    }
    return true;
  }

  deleteMany(keys: string[]): Promise<boolean> {
    const promises = [];
    for (const key of keys) {
      promises.push(this.delete(key));
    }

    return (
      Promise.allSettled(promises)
        // @ts-expect-error - x is an object
        .then(values => values.every(x => x.value === true))
    );
  }

  async clear(): Promise<void> {
    const rsp = await this.client.flushCache(this.cacheName);
    if (rsp instanceof CacheFlush.Error) {
      this.emit('error', rsp.message());
    }
  }

  async has(key: string): Promise<boolean> {
    const rsp = await this.client.itemGetTtl(this.cacheName, key);
    if (rsp instanceof CacheItemGetTtl.Hit) {
      return true;
    } else if (rsp instanceof CacheItemGetTtl.Error) {
      this.emit('error', rsp.message());
    }
    return false;
  }
}

export = KeyvMomento;
