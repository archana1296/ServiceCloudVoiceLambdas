let mockDecoderDataCallback = null;
let mockHttpDoneCallback = null;
let mockS3PutObjectFn = jest.fn().mockReturnValue({ promise: () => Promise.resolve() });

jest.mock('../SCVLoggingUtil', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('ebml', () => ({
  Decoder: jest.fn().mockImplementation(() => ({
    on: jest.fn((event, cb) => {
      if (event === 'data') mockDecoderDataCallback = cb;
    }),
    write: jest.fn(),
  })),
}));

jest.mock('wav', () => ({
  Writer: jest.fn().mockImplementation(() => {
    let mockFinishCb = null;
    return {
      on: jest.fn((event, cb) => {
        if (event === 'finish') mockFinishCb = cb;
      }),
      write: jest.fn(),
      end: jest.fn(function () {
        if (mockFinishCb) mockFinishCb();
      }),
      dataLength: '16000',
    };
  }),
}));

jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({ putObject: mockS3PutObjectFn })),
  KinesisVideo: jest.fn(() => ({
    getDataEndpoint: jest.fn().mockReturnValue({
      promise: () => Promise.resolve({ DataEndpoint: 'https://endpoint.example.com' }),
    }),
  })),
  KinesisVideoMedia: jest.fn(() => ({
    getMedia: jest.fn(() => ({
      removeListener: jest.fn(),
      on: jest.fn((event, cb) => {
        if (event === 'httpDone') mockHttpDoneCallback = cb;
      }),
      send: jest.fn(),
    })),
  })),
  Endpoint: jest.fn(),
  EventListeners: { Core: { HTTP_DATA: jest.fn() } },
}));

const SCVLoggingUtil = require('../SCVLoggingUtil');
const handler = require('../handler');

const CONTACT_A = 'contact-id-A';
const CONTACT_B = 'contact-id-B';
const STREAM_ARN = 'arn:aws:kinesisvideo:us-east-1:123456789012:stream/myStream/1234567890';
const START_FRAGMENT = '91343852333181432392682062622993';
const STOP_FRAGMENT = '91343852333181432392682062623033';

function buildEvent(contactId, overrides = {}) {
  const payload = JSON.stringify({
    ContactId: contactId,
    Attributes: { vm_flag: '1', vm_lang: 'en-US', vm_from: '+15551234567' },
    SystemEndpoint: { Address: '+15559876543' },
    InitiationTimestamp: '2026-03-25T10:00:00Z',
    DisconnectTimestamp: '2026-03-25T10:05:00Z',
    Recordings: [{
      Location: STREAM_ARN,
      FragmentStartNumber: START_FRAGMENT,
      FragmentStopNumber: STOP_FRAGMENT,
      ...overrides,
    }],
  });
  return {
    Records: [{
      kinesis: { data: Buffer.from(payload).toString('base64') },
    }],
  };
}

function emitTag(name, val) {
  mockDecoderDataCallback([null, { name: 'TagName', value: name }]);
  mockDecoderDataCallback([null, { name: 'TagString', value: val }]);
}

function emitAudioBlock(data) {
  mockDecoderDataCallback([null, { name: 'Block', payload: Buffer.from(data) }]);
}

async function startHandlerAndWait(event) {
  const handlerPromise = handler.handler(event);
  await new Promise((r) => setTimeout(r, 50));
  return { handlerPromise };
}

async function triggerHttpDoneAndAwait(handlerPromise) {
  mockHttpDoneCallback();
  await handlerPromise;
}

describe('VoiceMailAudioProcessing Tests', () => {
  beforeEach(() => {
    mockDecoderDataCallback = null;
    mockHttpDoneCallback = null;
    jest.clearAllMocks();
    mockS3PutObjectFn.mockReturnValue({ promise: () => Promise.resolve() });
  });

  it('exports a handler function', () => {
    expect(handler).toHaveProperty('handler');
    expect(typeof handler.handler).toBe('function');
  });

  it('stops processing when ContactId from stream does not match expected ContactId', async () => {
    const event = buildEvent(CONTACT_A);
    const { handlerPromise } = await startHandlerAndWait(event);

    emitTag('AWS_KINESISVIDEO_FRAGMENT_NUMBER', START_FRAGMENT);
    emitTag('ContactId', CONTACT_A);
    emitAudioBlock('audio-for-contact-A');

    emitTag('ContactId', CONTACT_B);
    emitAudioBlock('audio-for-contact-B-should-be-ignored');

    await triggerHttpDoneAndAwait(handlerPromise);

    expect(SCVLoggingUtil.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('ContactId boundary crossed'),
      })
    );
    expect(SCVLoggingUtil.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(`streamContactId: ${CONTACT_B}`),
      })
    );
  }, 10000);

  it('continues processing when ContactId from stream matches expected ContactId', async () => {
    const event = buildEvent(CONTACT_A);
    const { handlerPromise } = await startHandlerAndWait(event);

    emitTag('AWS_KINESISVIDEO_FRAGMENT_NUMBER', START_FRAGMENT);
    emitTag('ContactId', CONTACT_A);
    emitAudioBlock('audio-1');

    emitTag('ContactId', CONTACT_A);
    emitAudioBlock('audio-2');

    emitTag('ContactId', CONTACT_A);
    emitAudioBlock('audio-3');

    await triggerHttpDoneAndAwait(handlerPromise);

    const boundaryCalls = SCVLoggingUtil.info.mock.calls.filter(
      ([arg]) => arg.message && arg.message.includes('ContactId boundary crossed')
    );
    expect(boundaryCalls).toHaveLength(0);
  }, 10000);

  it('stops processing when fragment number exceeds stop fragment (existing behavior)', async () => {
    const event = buildEvent(CONTACT_A);
    const { handlerPromise } = await startHandlerAndWait(event);

    const beyondStopFragment = (BigInt(STOP_FRAGMENT) + BigInt(1)).toString();
    emitTag('AWS_KINESISVIDEO_FRAGMENT_NUMBER', beyondStopFragment);
    emitAudioBlock('should-not-process');

    await triggerHttpDoneAndAwait(handlerPromise);

    expect(SCVLoggingUtil.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('KVS processing completed for chunk'),
      })
    );
  }, 10000);

  it('ContactId boundary stops processing before fragment number check can trigger', async () => {
    const event = buildEvent(CONTACT_A);
    const { handlerPromise } = await startHandlerAndWait(event);

    emitTag('AWS_KINESISVIDEO_FRAGMENT_NUMBER', START_FRAGMENT);
    emitTag('ContactId', CONTACT_A);
    emitAudioBlock('audio-1');

    emitTag('ContactId', CONTACT_B);

    emitTag('AWS_KINESISVIDEO_FRAGMENT_NUMBER', START_FRAGMENT);
    emitAudioBlock('audio-from-contact-B');

    await triggerHttpDoneAndAwait(handlerPromise);

    expect(SCVLoggingUtil.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('ContactId boundary crossed'),
      })
    );

    const fragmentStopCalls = SCVLoggingUtil.info.mock.calls.filter(
      ([arg]) => arg.message && arg.message.includes('KVS processing completed for chunk')
    );
    expect(fragmentStopCalls).toHaveLength(0);
  }, 10000);
});
