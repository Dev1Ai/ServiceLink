import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { AuthedRequest, JwtUser } from "../common/types/request";

/**
 * Retrieves the authenticated user (or one of its properties) from the request.
 *
 * Example usage:
 * - `@CurrentUser() user: JwtUser`
 * - `@CurrentUser('sub') userId: string`
 */
export const CurrentUser = createParamDecorator(
  (
    property: keyof JwtUser | undefined,
    ctx: ExecutionContext,
  ): JwtUser | JwtUser[keyof JwtUser] | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = request?.user;

    if (!user) {
      return undefined;
    }

    return property ? user[property] : user;
  },
);
