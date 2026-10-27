import { createLocationRequester } from './location-request-core';

export const requestLocationJson = createLocationRequester((url, options) => fetch(url, options));
