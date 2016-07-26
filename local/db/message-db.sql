-- Creates the threads table
-- This is responsible for keeping the reference between topcoder entities
-- and Discourse threads
CREATE TABLE "threads" (
    "id" BIGINT NOT NULL,
    "reference" VARCHAR(30) NOT NULL,
    "referenceId" VARCHAR(30) NOT NULL,
    "discourseThreadId" BIGINT NOT NULL,
    "tag" VARCHAR(30),
    PRIMARY KEY ("id")
);

-- Creates the ReferenceLookup table
-- This table is responsible for holding endpoints to be used
-- to check if a member has access to a particular record
CREATE TABLE "referenceLookup" (
    "reference" VARCHAR(30) NOT NULL,
    "endpoint" VARCHAR(100) NOT NULL,
    PRIMARY KEY ("reference")
);
