import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PLAN_CATALOG } from './plan.catalog';

@ApiTags('plans')
@Controller({ path: 'plans', version: '1' })
export class PlansController {
  @Get()
  list() {
    return Object.values(PLAN_CATALOG);
  }
}
