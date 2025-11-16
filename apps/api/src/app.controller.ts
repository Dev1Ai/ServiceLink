import { Controller, Get } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiProperty,
} from "@nestjs/swagger";

class RootDto {
  @ApiProperty()
  ok!: boolean;
  @ApiProperty()
  service!: string;
  @ApiProperty()
  docs!: string;
}
@ApiTags("root")
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: "API root" })
  @ApiOkResponse({ type: RootDto })
  root() {
    return { ok: true, service: "api", docs: "/docs" };
  }
}
