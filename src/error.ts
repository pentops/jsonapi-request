export class APIError extends Error {
  status: number;

  requestIdentifier: string;

  traceId: string;

  constructor(status: number, requestIdentifier: string, traceId: string, errorResponse: any) {
    const message = errorResponse?.error || errorResponse?.message || status;

    super(message);

    this.name = this.constructor.name;
    this.status = status;
    this.requestIdentifier = requestIdentifier;
    this.traceId = traceId;
  }
}
