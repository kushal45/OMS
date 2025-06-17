import { Controller, Get, Param, Post, Delete, ParseIntPipe, HttpException, HttpStatus } from '@nestjs/common';
import { OutboxAdminService } from './outbox-admin.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiOkResponse, ApiBadRequestResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { OutboxEvent } from '../entity/outbox-event.entity';

@ApiTags('Outbox Admin')
@Controller('outbox-admin')
export class OutboxAdminController {
  constructor(private readonly outboxAdminService: OutboxAdminService) {}

  @Get('failed')
  @ApiOperation({ summary: 'List all failed outbox events' })
  @ApiOkResponse({
    description: 'List of failed outbox events',
    type: OutboxEvent,
    isArray: true,
  })
  async listFailed() {
    return this.outboxAdminService.listFailedEvents();
  }

  @Post('retry/:id')
  @ApiOperation({ summary: 'Retry a failed outbox event by ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({
    description: 'Retried event (now SENT or still FAILED)',
    type: OutboxEvent,
  })
  @ApiBadRequestResponse({ description: 'Event not found or not failed' })
  async retry(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.outboxAdminService.retryEvent(id);
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an outbox event by ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({
    description: 'Event deleted',
    schema: {
      example: { deleted: true },
    },
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.outboxAdminService.deleteEvent(id);
    return { deleted: true };
  }
}
