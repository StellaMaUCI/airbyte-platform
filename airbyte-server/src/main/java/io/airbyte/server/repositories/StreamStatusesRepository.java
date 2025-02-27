/*
 * Copyright (c) 2023 Airbyte, Inc., all rights reserved.
 */

package io.airbyte.server.repositories;

import static io.airbyte.db.instance.jobs.jooq.generated.Tables.STREAM_STATUSES;

import com.google.common.base.CaseFormat;
import io.airbyte.db.instance.jobs.jooq.generated.enums.JobStreamStatusJobType;
import io.airbyte.server.repositories.domain.StreamStatus;
import io.micronaut.data.jdbc.annotation.JdbcRepository;
import io.micronaut.data.model.Page;
import io.micronaut.data.model.Pageable;
import io.micronaut.data.model.query.builder.sql.Dialect;
import io.micronaut.data.repository.PageableRepository;
import io.micronaut.data.repository.jpa.JpaSpecificationExecutor;
import io.micronaut.data.repository.jpa.criteria.PredicateSpecification;
import java.util.UUID;
import lombok.Builder;
import org.jooq.TableField;

/**
 * Data Access layer for StreamStatus.
 */
@SuppressWarnings("MissingJavadocType")
@JdbcRepository(dialect = Dialect.POSTGRES)
public interface StreamStatusesRepository extends PageableRepository<StreamStatus, UUID>, JpaSpecificationExecutor<StreamStatus> {

  /**
   * Returns stream statuses filtered by the provided params.
   */
  default Page<StreamStatus> findAllFiltered(final FilterParams params) {
    var spec = Predicates.columnEquals(Columns.WORKSPACE_ID, params.workspaceId());
    var pageable = Pageable.unpaged();

    if (null != params.connectionId()) {
      spec = spec.and(Predicates.columnEquals(Columns.CONNECTION_ID, params.connectionId()));
    }

    if (null != params.jobId()) {
      spec = spec.and(Predicates.columnEquals(Columns.JOB_ID, params.jobId()));
    }

    if (null != params.streamNamespace()) {
      spec = spec.and(Predicates.columnEquals(Columns.STREAM_NAMESPACE, params.streamNamespace()));
    }

    if (null != params.streamName()) {
      spec = spec.and(Predicates.columnEquals(Columns.STREAM_NAME, params.streamName()));
    }

    if (null != params.attemptNumber()) {
      spec = spec.and(Predicates.columnEquals(Columns.ATTEMPT_NUMBER, params.attemptNumber()));
    }

    if (null != params.jobType()) {
      spec = spec.and(Predicates.columnEquals(Columns.JOB_TYPE, params.jobType()));
    }

    if (null != params.pagination()) {
      final var offset = params.pagination().offset();
      final var size = params.pagination().size();
      pageable = Pageable.from(offset, size);
    }

    return findAll(spec, pageable);
  }

  /**
   * Pagination params.
   */
  record Pagination(int offset,
                    int size) {}

  /**
   * Params for filtering our list functionality.
   */
  @Builder
  record FilterParams(UUID workspaceId,
                      UUID connectionId,
                      Long jobId,
                      String streamNamespace,
                      String streamName,
                      Integer attemptNumber,
                      JobStreamStatusJobType jobType,
                      Pagination pagination) {}

  /**
   * Predicates for dynamic query building. Portable.
   */
  class Predicates {

    /*
     * Jooq holds onto the names of the columns in snake_case, so we have to convert to lower camelCase
     * for the JpaSpecificationExecutor to do predicate filtering.
     */
    static String formatJooqColumnName(final TableField<?, ?> jooqColumn) {
      return CaseFormat.LOWER_UNDERSCORE.to(CaseFormat.LOWER_CAMEL, jooqColumn.getName());
    }

    static <U> PredicateSpecification<StreamStatus> columnEquals(final String columnName, final U value) {
      return (root, criteriaBuilder) -> criteriaBuilder.equal(root.get(columnName), value);
    }

  }

  /**
   * Column names for StreamStatus in camel case for the JpaSpecificationExecutor. In lieu of a
   * metamodel, we pre-create JPA-friendly column names from the already generated Jooq model.
   */
  class Columns {

    static String WORKSPACE_ID = Predicates.formatJooqColumnName(STREAM_STATUSES.WORKSPACE_ID);
    static String CONNECTION_ID = Predicates.formatJooqColumnName(STREAM_STATUSES.CONNECTION_ID);
    static String JOB_ID = Predicates.formatJooqColumnName(STREAM_STATUSES.JOB_ID);
    static String STREAM_NAMESPACE = Predicates.formatJooqColumnName(STREAM_STATUSES.STREAM_NAMESPACE);
    static String STREAM_NAME = Predicates.formatJooqColumnName(STREAM_STATUSES.STREAM_NAME);
    static String ATTEMPT_NUMBER = Predicates.formatJooqColumnName(STREAM_STATUSES.ATTEMPT_NUMBER);
    static String JOB_TYPE = Predicates.formatJooqColumnName(STREAM_STATUSES.JOB_TYPE);

  }

}
