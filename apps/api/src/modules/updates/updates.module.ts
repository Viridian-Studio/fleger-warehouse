import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UpdatesController } from './updates.controller';
import { UpdatesService } from './updates.service';
import { Update, UpdateSchema } from './schemas/update.schema';
import { UpdateChange, UpdateChangeSchema } from './schemas/update-change.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Update.name, schema: UpdateSchema },
      { name: UpdateChange.name, schema: UpdateChangeSchema }
    ])
  ],
  controllers: [UpdatesController],
  providers: [UpdatesService],
  exports: [UpdatesService]
})
export class UpdatesModule {}
