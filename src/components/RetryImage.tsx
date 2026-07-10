/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * <img> that automatically retries a couple of times on load failure
 * (transient proxy/CDN errors), then hides itself instead of showing a
 * broken-image icon.
 */

import React, { useEffect, useState } from 'react';

interface RetryImageProps {
  src: string;
  alt: string;
  className?: string;
}

const MAX_RETRIES = 2;

export default function RetryImage({ src, alt, className }: RetryImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  if (failed) return null;

  // A retry query param busts the browser's negative cache so the request
  // actually goes out again.
  const url = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (attempt < MAX_RETRIES) {
          setTimeout(() => setAttempt((a) => a + 1), 500 * (attempt + 1));
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
