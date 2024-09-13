import { stringify } from 'qs';
import { APIError } from './error';

export { APIError };

let uuid: typeof import('uuid').v4 | undefined;

async function loadUUID() {
  try {
    if (uuid) {
      return uuid;
    }

    const uuidModule = await import('uuid');
    uuid = uuidModule.v4;

    return uuid;
  } catch {}
}

(async function() {
  await loadUUID();
}());

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

async function processResponse<TRes>(rawResponse: Response): Promise<TRes> {
  switch (rawResponse.headers.get('Content-Type')) {
    case 'application/json':
      return (await rawResponse.json()) as Promise<TRes>;
    case 'application/pdf':
      return (await rawResponse.blob()) as unknown as Promise<TRes>;
    case 'multipart/form-data':
    case 'application/x-www-form-urlencoded':
      return (await rawResponse.formData()) as unknown as Promise<TRes>;
    default:
      return (await rawResponse.text()) as unknown as Promise<TRes>;
  }
}

export interface TypedRequestInit<TReqBody extends unknown> extends Omit<RequestInit, 'body'> {
  body: TReqBody;
}

function prepareParameters(params: any | undefined): any {
  if (params === '' || params === undefined || params === null) {
    return null;
  }

  if (Array.isArray(params)) {
    return params.reduce((accum, curr) => {
      const prepared = prepareParameters(curr);
      if (prepared) {
        accum.push(prepared);
      }

      return accum;
    }, []);
  }

  if (params instanceof Date) {
    return params;
  }

  if (typeof params === 'object') {
    return Object.entries(params || {}).reduce(
      (accum, [k, v]) => {
        if (!['', null, undefined].includes(v as any)) {
          return { ...accum, [k]: prepareParameters(v) };
        }

        return accum;
      },
      {} as Record<string, any>,
    );
  }

  return params;
}

export function buildSearchString(params: any | undefined): string {
  const preparedParams = prepareParameters(params);
  if (!preparedParams) {
    return '';
  }

  // Convert objects to JSON strings that jsonapi can parse
  if (typeof preparedParams === 'object') {
    Object.keys(preparedParams).forEach((key) => {
      if (typeof preparedParams[key] === 'object' && !(preparedParams[key] instanceof Date)) {
        preparedParams[key] = JSON.stringify(preparedParams[key]);
      }
    });
  }

  return stringify(preparedParams, { addQueryPrefix: true, arrayFormat: 'repeat', allowDots: true, skipNulls: true });
}

export function buildMergedRequestInit<TReq extends unknown = undefined>(
  method: HTTPMethod,
  basePath: string,
  unboundPath: string,
  params?: TReq,
  requestInit?: RequestInit,
): [HTTPMethod, string, TypedRequestInit<TReq> | undefined] {
  const paramCopy = JSON.parse(JSON.stringify(params || {}));
  let pathname = unboundPath;

  if (basePath) {
    pathname = new URL(unboundPath, basePath).pathname;
  }

  const urlSegments = pathname.split('/');

  for (let i = 0; i < urlSegments.length; i += 1) {
    const segment = urlSegments[i];
    if (segment.startsWith(':')) {
      const key = segment.slice(1);
      urlSegments[i] = paramCopy[key];
      delete paramCopy[key];
    }
  }

  const fullPath = `${basePath}${urlSegments.join('/')}`;

  if (method === 'GET') {
    return [method, `${fullPath}${buildSearchString(paramCopy)}`, requestInit as TypedRequestInit<TReq>];
  }

  return [method, fullPath, { ...(requestInit || {}), body: paramCopy }];
}

export function buildSplitRequestInit<
  TReqPathParameters extends unknown = undefined,
  TReqQueryParameters extends unknown = undefined,
  TReqBody extends unknown = undefined,
>(
  method: HTTPMethod,
  basePath: string,
  unboundPath: string,
  pathParameters?: TReqPathParameters,
  queryParameters?: TReqQueryParameters,
  body?: TReqBody,
  requestInit?: RequestInit,
): [HTTPMethod, string, TypedRequestInit<TReqBody> | undefined] {
  let pathname = unboundPath;

  if (basePath) {
    pathname = new URL(unboundPath, basePath).pathname;
  }

  const urlSegments = pathname.split('/');

  if (pathParameters) {
    for (let i = 0; i < urlSegments.length; i += 1) {
      const segment = urlSegments[i];
      if (segment.startsWith(':')) {
        const key = segment.slice(1);
        urlSegments[i] = (pathParameters as Record<string, string>)[key];
      }
    }
  }

  const fullPath = `${basePath}${urlSegments.join('/')}${buildSearchString(queryParameters)}`;

  return [method, fullPath, { ...(requestInit || {}), body } as TypedRequestInit<TReqBody>];
}

export async function makeRequest<TRes, TReqBody extends unknown = undefined>(
  method: HTTPMethod,
  path: string,
  request?: TypedRequestInit<TReqBody>,
): Promise<TRes | undefined> {
  const { body, headers, ...requestInit } = request || {};
  let traceId: string = '';

  if (uuid) {
    traceId = uuid();
  }

  const requestOptions: RequestInit = {
    method,
    credentials: 'include',
    mode: 'cors',
    ...requestInit,
    headers: new Headers({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Trace': traceId,
      ...headers,
    }),
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(path, requestOptions);

  const responseBody = await processResponse<TRes>(response);

  if (!response.ok) {
    throw new APIError(response.status, `${method}:${path}`, traceId, responseBody);
  }

  return responseBody;
}

export function makeCancellableRequest<TRes, TReqBody extends unknown = undefined>(
  method: HTTPMethod,
  path: string,
  request?: TypedRequestInit<TReqBody>,
): [Promise<TRes | undefined>, AbortController] {
  const controller = new AbortController();
  return [makeRequest(method, path, { ...request, signal: controller.signal } as TypedRequestInit<TReqBody>), controller];
}
