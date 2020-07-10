/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { FFOX, CHROMIUM, WEBKIT, WIN, CHANNEL } = require('./utils').testOptions(browserType);

describe.skip(!CHANNEL)('Channels', function() {
  it('should work', async({browser}) => {
    expect(!!browser._connection).toBeTruthy();
  });

  it('should scope context handles', async({browser, server}) => {
    const GOLDEN_PRECONDITION = {
      _guid: '',
      objects: [
        { _guid: 'chromium' },
        { _guid: 'firefox' },
        { _guid: 'webkit' },
        { _guid: 'playwright' },
        { _guid: 'browser', objects: [] },
      ]
    };
    await expectScopeState(browser, GOLDEN_PRECONDITION);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await expectScopeState(browser, {
      _guid: '',
      objects: [
        { _guid: 'chromium' },
        { _guid: 'firefox' },
        { _guid: 'webkit' },
        { _guid: 'playwright' },
        { _guid: 'browser', objects: [
          { _guid: 'context', objects: [
            { _guid: 'frame' },
            { _guid: 'page' },
            { _guid: 'request' },
            { _guid: 'response' },
          ]},
        ] },
      ]
    });

    await context.close();
    await expectScopeState(browser, GOLDEN_PRECONDITION);
  });

  it.skip(!CHROMIUM)('should scope CDPSession handles', async({browserType, browser, server}) => {
    const GOLDEN_PRECONDITION = {
      _guid: '',
      objects: [
        { _guid: 'chromium' },
        { _guid: 'firefox' },
        { _guid: 'webkit' },
        { _guid: 'playwright' },
        { _guid: 'browser', objects: [] },
      ]
    };
    await expectScopeState(browserType, GOLDEN_PRECONDITION);

    const session = await browser.newBrowserCDPSession();
    await expectScopeState(browserType, {
      _guid: '',
      objects: [
        { _guid: 'chromium' },
        { _guid: 'firefox' },
        { _guid: 'webkit' },
        { _guid: 'playwright' },
        { _guid: 'browser', objects: [
          { _guid: 'cdpSession', objects: [] },
        ] },
      ]
    });

    await session.detach();
    await expectScopeState(browserType, GOLDEN_PRECONDITION);
  });

  it('should scope browser handles', async({browserType, defaultBrowserOptions}) => {
    const GOLDEN_PRECONDITION = {
      _guid: '',
      objects: [
        { _guid: 'chromium' },
        { _guid: 'firefox' },
        { _guid: 'webkit' },
        { _guid: 'playwright' },
        { _guid: 'browser', objects: [] },
      ]
    };
    await expectScopeState(browserType, GOLDEN_PRECONDITION);

    const browser = await browserType.launch(defaultBrowserOptions);
    await browser.newContext();
    await expectScopeState(browserType, {
      _guid: '',
      objects: [
        { _guid: 'chromium' },
        { _guid: 'firefox' },
        { _guid: 'webkit' },
        { _guid: 'playwright' },
        { _guid: 'browser', objects: [
          { _guid: 'context', objects: [] },
        ] },
        { _guid: 'browser', objects: [] },
      ]
    });

    await browser.close();
    await expectScopeState(browserType, GOLDEN_PRECONDITION);
  });
});

async function expectScopeState(object, golden) {
  golden = trimGuids(golden);
  const remoteState = trimGuids(await object._channel.debugScopeState());
  const localState = trimGuids(object._connection._debugScopeState());
  expect(localState).toEqual(golden);
  expect(remoteState).toEqual(golden);
}

function compareObjects(a, b) {
  if (a._guid !== b._guid)
    return a._guid.localeCompare(b._guid);
  if (a.objects && !b.objects)
    return -1;
  if (!a.objects && b.objects)
    return 1;
  if (!a.objects && !b.objects)
    return 0;
  return a.objects.length - b.objects.length;
}

function trimGuids(object) {
  if (Array.isArray(object))
    return object.map(trimGuids).sort(compareObjects);
  if (typeof object === 'object') {
    const result = {};
    for (const key in object)
      result[key] = trimGuids(object[key]);
    return result;
  }
  if (typeof object === 'string')
    return object ? object.match(/[^@]+/)[0] : '';
  return object;
}
