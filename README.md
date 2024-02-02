# jsonapi-request
A TypeScript fetch wrapper for making requests to [jsonapi](https://github.com/pentops/jsonapi) projects.

Basic use example:

```ts
import { buildMergedRequestInit, buildSplitRequestInit, makeRequest } from '@pentops/jsonapi-request';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
  return makeRequest<LoginResponse, LoginRequest>(...buildMergedRequestInit('POST', '/api/v1', '/login', request));
};

interface GetUserRequestPathParameters {
  id: string;
}

interface GetUserRequestQueryParameters {
  includeProfile?: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
}

interface UserResponse {
  user: User;
}

export async function getUser(id: string, includeProfile?: boolean): Promise<UserResponse> {
  return makeRequest<UserResponse>(...buildSplitRequestInit<GetUserRequestPathParameters, GetUserRequestQueryParameters>('GET', '/api/v1', '/users/:id', { id }, { includeProfile }));
}
```

## buildSplitRequestInit
Use buildSplitRequestInit if your types are separated into request bodies, path parameters, and query parameters.

## buildMergedRequestInit
Use buildMergedRequestInit if your types are merged into a single request type. Path parameters (denoted using colon format, e.g., :id) are replaced with the values in the request path.
Other parameters will be added to the query string for GET requests and the request body for other requests.

### Peer Dependencies
You will need to have `uuid` installed as a peer dependency.
