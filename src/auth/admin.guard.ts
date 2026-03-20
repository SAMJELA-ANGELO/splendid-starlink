import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  private logger = new Logger(AdminGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug(`AdminGuard - User from request: ${JSON.stringify(user)}`);

    if (!user || !user.username) {
      this.logger.warn('AdminGuard - No user or username found in request');
      throw new ForbiddenException('Access denied: admin credentials required');
    }

    if (user.username !== 'splendid') {
      this.logger.warn(`AdminGuard - User ${user.username} is not admin (splendid)`);
      throw new ForbiddenException('Access denied: only admin can access this endpoint');
    }

    this.logger.debug(`AdminGuard - User ${user.username} authorized`);
    return true;
  }
}
