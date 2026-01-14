import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RetrievalService } from './retrieval.service';

@ApiTags('Retrieval')
@Controller('retrieval')
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Get(':documentId')
  @ApiOperation({ summary: 'Retrieve relevant chunks from a document' })
  @ApiParam({
    name: 'documentId',
    type: Number,
    description: 'ID of the document',
    example: 42,
  })
  @ApiQuery({
    name: 'query',
    type: String,
    description: 'Search query',
    example: 'machine learning basics',
  })
  async retrieveRelevantChunks(
    @Param('documentId') documentId: string,
    @Query('query') query: string,
  ) {
    if (!query) {
      throw new Error('Query parameter is required');
    }

    return this.retrievalService.retrieveRelevantChunks(
      query,
      Number(documentId),
    );
  }
}
