import { Test, TestingModule } from '@nestjs/testing';
import { RetrievalController } from './retrieval.controller';

describe('RetrievalController', () => {
  let controller: RetrievalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetrievalController],
    }).compile();

    controller = module.get<RetrievalController>(RetrievalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
