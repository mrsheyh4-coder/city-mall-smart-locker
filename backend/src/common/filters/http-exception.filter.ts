import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponse {
  error: string;
  message: string | string[];
  path: string;
  statusCode: number;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{ url: string }>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = this.buildPayload(exception, request.url, status);

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(payload.message, exception);
    }

    response.status(status).json(payload);
  }

  private buildPayload(
    exception: unknown,
    path: string,
    statusCode: number,
  ): ErrorResponse {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const body = response as Partial<ErrorResponse>;

        return {
          error: body.error ?? exception.name,
          message: body.message ?? exception.message,
          path,
          statusCode,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        error: exception.name,
        message: exception.message,
        path,
        statusCode,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      error: 'InternalServerError',
      message: 'Unexpected server error',
      path,
      statusCode,
      timestamp: new Date().toISOString(),
    };
  }
}
