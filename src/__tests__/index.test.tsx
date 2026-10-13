// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@testing-library/jest-dom';
import { render } from '@lynx-js/react/testing-library';
import { expect, test } from '@rstest/core';

import { App } from '../App';

test('App', async () => {
  const { findAllByText } = render(<App />);
  // 「音乐库」出现在 吸顶栏/大标题/Tab 三处,渲染成功即认为挂载正常
  const elements = await findAllByText('音乐库');

  expect(elements.length).toBeGreaterThanOrEqual(3);
});
