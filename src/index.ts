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

class KeyvMomento<Value = never> extends EventEmitter implements Store<Value> {
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

  async set(key: string, value: Value, ttl?: number) {
    const options: {ttl?: number} = {};

    if (ttl !== undefined) {
      // eslint-disable-next-line no-multi-assign
      options.ttl = Math.floor(ttl / 1000); // Moving to seconds
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
