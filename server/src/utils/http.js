export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const forbidden = (msg = 'You are not allowed to do this') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
