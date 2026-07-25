import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import {
  demoLoginRequestSchema,
  type CurrentUserResponse,
  type DemoUsersResponse,
} from '@good-job/contracts';
import { database, EmployeeStatus } from '@good-job/database';
import type { Request, Response } from 'express';

import { ApiException } from '../http/api.exception.js';
import { CONFIG } from '../config.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import type { AuthenticatedPrincipal } from './authenticated-principal.js';
import { CurrentUserService } from './current-user.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';

@Controller()
export class AuthController {
  constructor(
    @Inject(CONFIG) private readonly config: ServerConfig,
    @Inject(CurrentUserService)
    private readonly currentUser: CurrentUserService,
  ) {}

  @Get('auth/demo-users')
  async demoUsers(): Promise<DemoUsersResponse> {
    const employees = await database.employee.findMany({
      where: {
        status: EmployeeStatus.active,
        organization: { slug: this.config.DEMO_ORGANIZATION_SLUG },
      },
      include: { team: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    return {
      users: employees.map((employee) => ({
        id: employee.id,
        displayName: employee.displayName,
        email: employee.email,
        avatarUrl: employee.avatarUrl,
        teamName: employee.team?.name ?? null,
      })),
    };
  }

  @Post('auth/demo-login')
  async login(
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<CurrentUserResponse> {
    const parsed = demoLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The login request is invalid.',
        fieldErrors: Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.') || 'request',
            issue.message,
          ]),
        ),
      });
    }
    const employeeId = parsed.data.employeeId;

    const employee = await database.employee.findUnique({
      where: { id: employeeId },
      select: { status: true, organization: { select: { slug: true } } },
    });
    if (
      !employee ||
      employee.organization.slug !== this.config.DEMO_ORGANIZATION_SLUG
    ) {
      throw new ApiException(404, {
        code: 'RESOURCE_NOT_FOUND',
        message: 'The selected demo user is unavailable.',
      });
    }
    if (employee.status !== EmployeeStatus.active) {
      throw new ApiException(403, {
        code: 'EMPLOYEE_INACTIVE',
        message: 'The selected employee is inactive.',
      });
    }

    const principal = await this.currentUser.findActivePrincipal(employeeId);
    if (!principal) {
      throw new ApiException(503, {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'The session could not be created.',
      });
    }
    await this.regenerate(request);
    request.session.employeeId = principal.employeeId;
    await this.save(request);
    return principal;
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): CurrentUserResponse {
    return { user: principal.user, organization: principal.organization };
  }

  @Post('auth/logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookie = request.session.cookie;
    await new Promise<void>((resolve, reject) =>
      request.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    response.clearCookie(request.app.get('sessionCookieName') as string, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookie.secure === true,
      path: '/',
    });
  }

  private async regenerate(request: Request): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      request.session.regenerate((error) =>
        error ? reject(error) : resolve(),
      ),
    );
  }

  private async save(request: Request): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      request.session.save((error) => (error ? reject(error) : resolve())),
    );
  }
}
