import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApplicationDetailsService } from './application-details.service';

@ApiTags('application-details')
@Controller({ path: 'application-details', version: '1' })
export class ApplicationDetailsController {
  constructor(private readonly applicationDetails: ApplicationDetailsService) {}

  @Get()
  get() {
    return this.applicationDetails.get();
  }
}
