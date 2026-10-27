import { createLocationRequester, createNativeLocationRequest } from './location-request-core';

export const requestLocationJson = createLocationRequester(
  (url, options) => fetch(url, options),
  createNativeLocationRequest(() => new XMLHttpRequest()),
);
