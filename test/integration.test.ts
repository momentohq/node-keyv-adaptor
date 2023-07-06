import {EventEmitter} from 'events';
import Keyv from 'keyv';
import {v4} from 'uuid';
import {SetupIntegrationTest} from './integration-setup';

const snooze = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Handle all the test with listeners.
EventEmitter.setMaxListeners(200);

const {client} = SetupIntegrationTest();

describe('simple get and set', () => {
  it('keyv get / no expired', async () => {
    const testKey = v4();
    const testValue = v4();
    await client.set(testKey, testValue);
    expect(await client.get(testKey)).toEqual(testValue);
  });
  it('keyv clear', async () => {
    const testKey = v4();
    await client.set(testKey, 'bar');
    await client.clear();
    expect(await client.get(testKey)).toBeUndefined();
  });
  it('keyv get', async () => {
    const testKey = v4();
    const testValue = v4();
    expect(await client.get(testKey)).toBeUndefined();
    await client.set(testKey, testValue);
    expect(await client.get(testKey)).toEqual(testValue);
  });
  it('get with namespace', async () => {
    const testKey = v4();
    const testValues = [v4(), v4()];
    const keyv1 = new Keyv({
      store: client,
      namespace: '1',
    });
    const keyv2 = new Keyv({
      store: client,
      namespace: '2',
    });

    await keyv1.set(testKey, testValues[0]);
    expect(await keyv1.get(testKey)).toEqual(testValues[0]);

    await keyv2.set(testKey, testValues[1]);
    expect(await keyv2.get(testKey)).toEqual(testValues[1]);
  });

  it('keyv get / should still exist', async () => {
    const keyv = new Keyv({store: client});
    const testKey = v4();
    const testValue = v4();
    await keyv.set(testKey, testValue, 10_000);

    await snooze(2000);

    const value = (await keyv.get(testKey)) as string;

    expect(value).toEqual(testValue);
  });
  it('keyv get / expired existing', async () => {
    const testKey = v4();
    await client.set(testKey, 'expiring_soon', 1000);

    await snooze(3000);

    const value = await client.get(testKey);

    expect(value).toBeUndefined();
  });

  it('keyv get / expired', async () => {
    const keyv = new Keyv({store: client});

    const testKey = v4();
    await keyv.set(testKey, 'expiring soon', 1000);

    await snooze(1000);

    expect(await keyv.get(testKey)).toBeUndefined();
  });

  it('keyv getMany', async () => {
    const testKeys = [v4(), v4()];
    const testValues = [v4(), v4()];

    const rsp1 = await client.getMany(testKeys);
    expect(Array.isArray(rsp1)).toBeTruthy();
    expect(rsp1).toEqual([]);

    await client.set(testKeys[0], testValues[0]);
    await client.set(testKeys[1], testValues[1]);

    const rsp2 = await client.getMany(testKeys);
    expect(rsp2).toEqual(testValues);
  });

  it('keyv has / false', async () => {
    expect(await client.has(v4())).toEqual(false);
  });
  it('keyv has / true', async () => {
    const testKey = v4();
    await client.set(testKey, v4());
    expect(await client.has(testKey)).toEqual(true);
  });
  it('keyv should emit errors properly as event emitter', async () => {
    try {
      await client.set(v4(), v4(), -300);
    } catch (e: unknown) {
      const error = e as {code: string; context: string};
      expect(error.code).toEqual('ERR_UNHANDLED_ERROR');
      expect(error.context).toEqual(
        'Invalid argument passed to Momento client: ttl must be a positive integer'
      );
    }
  });
});
