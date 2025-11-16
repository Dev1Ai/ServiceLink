import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    if (
      !isHttp ||
      (isHttp && (exception as HttpException).getStatus() >= 500)
    ) {
      // eslint-disable-next-line no-console
      console.error(exception);
    }
    const status = isHttp
      ? (exception as HttpException).getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const resp = isHttp
      ? (exception as HttpException).getResponse()
      : undefined;
    type HttpPayload =
      | { message?: string | string[]; error?: string }
      | string
      | undefined;
    const payload = resp as HttpPayload;
    let message: string | string[] = "Internal server error";
    let error: string = isHttp ? HttpStatus[status] : "Internal Server Error";
    if (typeof payload === "string") {
      message = payload;
    } else if (payload && typeof payload === "object") {
      const obj = payload as { message?: string | string[]; error?: string };
      message =
        obj.message ??
        (isHttp
          ? (exception as HttpException).message
          : "Internal server error");
      error = obj.error ?? error;
    } else if (isHttp) {
      message = (exception as HttpException).message;
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
