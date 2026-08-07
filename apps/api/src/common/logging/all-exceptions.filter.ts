import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    console.error(
      JSON.stringify({
        requestId: request.requestId,
        tenantId: request.tenantContext?.tenantId,
        userId: request.user?.sub,
        status,
        path: request.url,
        message: exception instanceof Error ? exception.message : 'Unknown error'
      })
    );

    response.status(status).json({
      statusCode: status,
      requestId: request.requestId,
      message: exception instanceof HttpException ? exception.message : 'Internal server error'
    });
  }
}
