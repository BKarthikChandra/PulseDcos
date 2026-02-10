import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1770711809661 implements MigrationInterface {
    name = 'Init1770711809661'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("user_id" SERIAL NOT NULL, "username" character varying(50) NOT NULL, "email" character varying(100) NOT NULL, "password_hash" character varying(255) NOT NULL, "is_deleted" boolean NOT NULL DEFAULT false, "created_on" TIMESTAMP NOT NULL DEFAULT now(), "created_by" integer, "updated_on" TIMESTAMP NOT NULL DEFAULT now(), "updated_by" integer, CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_96aac72f1574b88752e9fb00089" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TABLE "document_pages" ("document_page_id" SERIAL NOT NULL, "document_id" integer NOT NULL, "page_number" integer NOT NULL, "raw_text" text NOT NULL, "raw_hash" text, "cleanedText" text, "clean_hash" text, "created_on" TIMESTAMP NOT NULL DEFAULT now(), "created_by" integer, "updated_on" TIMESTAMP, "updated_by" integer, CONSTRAINT "UQ_fa2d8c48c0d4a9dd12298e7f627" UNIQUE ("document_id", "page_number"), CONSTRAINT "PK_af85c3653455cdb34b382b1c080" PRIMARY KEY ("document_page_id"))`);
        await queryRunner.query(`CREATE TABLE "document" ("document_id" SERIAL NOT NULL, "document_name" character varying(255) NOT NULL, "document_path" character varying(500) NOT NULL, "mimeType" character varying(50) NOT NULL, "status" character varying NOT NULL, "created_on" TIMESTAMP NOT NULL DEFAULT now(), "created_by" integer, "updated_on" TIMESTAMP, "updated_by" integer, CONSTRAINT "PK_78f5e16f1322a7b2b150364dddc" PRIMARY KEY ("document_id"))`);
        await queryRunner.query(`CREATE TABLE "document_chunks" ("id" SERIAL NOT NULL, "document_id" integer NOT NULL, "page_start" integer NOT NULL, "page_end" integer NOT NULL, "chunk_index" integer NOT NULL, "sectionPath" jsonb, "section_title" text, "chunk_text" text NOT NULL, "chunk_hash" text, "token_count" integer, "status" character varying NOT NULL DEFAULT 'PENDING', "created_on" TIMESTAMP NOT NULL DEFAULT now(), "created_by" integer, "updated_on" TIMESTAMP, "updated_by" integer, CONSTRAINT "uq_document_chunk_hash" UNIQUE ("document_id", "chunk_hash"), CONSTRAINT "PK_7f9060084e9b872dbb567193978" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_chunks_doc_chunk" ON "document_chunks" ("document_id", "chunk_index") `);
        await queryRunner.query(`CREATE INDEX "idx_chunks_document" ON "document_chunks" ("document_id") `);
        await queryRunner.query(`CREATE TABLE "chunk_embeddings" ("chunk_embedding_id" SERIAL NOT NULL, "chunk_id" integer NOT NULL, "model_name" character varying(100) NOT NULL, "embedding" vector(3072) NOT NULL, "created_on" TIMESTAMP NOT NULL DEFAULT now(), "created_by" integer, "updated_on" TIMESTAMP NOT NULL DEFAULT now(), "updated_by" integer, CONSTRAINT "PK_05e360ddb18cc5010ef210a572b" PRIMARY KEY ("chunk_embedding_id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_de5aca7f1516342116f8be6124" ON "chunk_embeddings" ("chunk_id", "model_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_89eb4842eec02ea7bac89890ce" ON "chunk_embeddings" ("chunk_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_89eb4842eec02ea7bac89890ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_de5aca7f1516342116f8be6124"`);
        await queryRunner.query(`DROP TABLE "chunk_embeddings"`);
        await queryRunner.query(`DROP INDEX "public"."idx_chunks_document"`);
        await queryRunner.query(`DROP INDEX "public"."idx_chunks_doc_chunk"`);
        await queryRunner.query(`DROP TABLE "document_chunks"`);
        await queryRunner.query(`DROP TABLE "document"`);
        await queryRunner.query(`DROP TABLE "document_pages"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
