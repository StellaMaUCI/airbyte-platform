/*
 * Copyright (c) 2023 Airbyte, Inc., all rights reserved.
 */

package io.airbyte.workers.internal.book_keeping;

import com.google.common.annotations.VisibleForTesting;
import io.airbyte.commons.features.FeatureFlags;
import io.airbyte.commons.json.Jsons;
import io.airbyte.config.FailureReason;
import io.airbyte.config.State;
import io.airbyte.protocol.models.AirbyteEstimateTraceMessage;
import io.airbyte.protocol.models.AirbyteMessage;
import io.airbyte.protocol.models.AirbyteRecordMessage;
import io.airbyte.protocol.models.AirbyteStateMessage;
import io.airbyte.protocol.models.AirbyteTraceMessage;
import io.airbyte.workers.helper.FailureHelper;
import io.airbyte.workers.internal.state_aggregator.DefaultStateAggregator;
import io.airbyte.workers.internal.state_aggregator.StateAggregator;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;

/**
 * This class is responsible for stats and metadata tracking surrounding
 * {@link AirbyteRecordMessage}.
 * <p>
 * It is not intended to perform meaningful operations - transforming, mutating, triggering
 * downstream actions etc. - on specific messages.
 */
@Slf4j
public class AirbyteMessageTracker implements MessageTracker {

  private final AtomicReference<State> sourceOutputState;
  private final AtomicReference<State> destinationOutputState;
  private final SyncStatsTracker syncStatsTracker;
  private final List<AirbyteTraceMessage> destinationErrorTraceMessages;
  private final List<AirbyteTraceMessage> sourceErrorTraceMessages;
  private final StateAggregator stateAggregator;
  private final FeatureFlags featureFlags;
  private final boolean featureFlagLogConnectorMsgs;

  public AirbyteMessageTracker(final FeatureFlags featureFlags) {
    this(new DefaultSyncStatsTracker(), featureFlags);
  }

  public AirbyteMessageTracker(final SyncStatsTracker syncStatsTracker, final FeatureFlags featureFlags) {
    this(new DefaultStateAggregator(featureFlags.useStreamCapableState()), syncStatsTracker, featureFlags);
  }

  protected AirbyteMessageTracker(final StateAggregator stateAggregator, final SyncStatsTracker syncStatsTracker, final FeatureFlags featureFlags) {
    this.sourceOutputState = new AtomicReference<>();
    this.destinationOutputState = new AtomicReference<>();
    this.syncStatsTracker = syncStatsTracker;
    this.destinationErrorTraceMessages = new ArrayList<>();
    this.sourceErrorTraceMessages = new ArrayList<>();
    this.stateAggregator = stateAggregator;
    this.featureFlags = featureFlags;
    this.featureFlagLogConnectorMsgs = featureFlags.logConnectorMessages();
  }

  @VisibleForTesting
  protected AirbyteMessageTracker(final StateDeltaTracker stateDeltaTracker,
                                  final StateAggregator stateAggregator,
                                  final StateMetricsTracker stateMetricsTracker,
                                  final FeatureFlags featureFlags) {
    this(stateAggregator, new DefaultSyncStatsTracker(stateDeltaTracker, stateMetricsTracker), featureFlags);
  }

  @Override
  public void acceptFromSource(final AirbyteMessage message) {
    logMessageAsJSON("source", message);

    switch (message.getType()) {
      case TRACE -> handleEmittedTrace(message.getTrace(), AirbyteMessageOrigin.SOURCE);
      case RECORD -> handleSourceEmittedRecord(message.getRecord());
      case STATE -> handleSourceEmittedState(message.getState());
      case CONTROL -> log.debug("Control message not currently tracked.");
      default -> log.warn("Invalid message type for message: {}", message);
    }
  }

  @Override
  public void acceptFromDestination(final AirbyteMessage message) {
    logMessageAsJSON("destination", message);

    switch (message.getType()) {
      case TRACE -> handleEmittedTrace(message.getTrace(), AirbyteMessageOrigin.DESTINATION);
      case STATE -> handleDestinationEmittedState(message.getState());
      case CONTROL -> log.debug("Control message not currently tracked.");
      default -> log.warn("Invalid message type for message: {}", message);
    }
  }

  /**
   * When a source emits a record, increment the running record count, the total record count, and the
   * total byte count for the record's stream.
   */
  private void handleSourceEmittedRecord(final AirbyteRecordMessage recordMessage) {

    syncStatsTracker.updateStats(recordMessage);
  }

  /**
   * When a source emits a state, persist the current running count per stream to the
   * {@link StateDeltaTracker}. Then, reset the running count per stream so that new counts can start
   * recording for the next state. Also add the state to list so that state order is tracked
   * correctly.
   */
  private void handleSourceEmittedState(final AirbyteStateMessage stateMessage) {
    sourceOutputState.set(new State().withState(stateMessage.getData()));
    syncStatsTracker.updateSourceStatesStats(stateMessage);
  }

  /**
   * When a destination emits a state, mark all uncommitted states up to and including this state as
   * committed in the {@link StateDeltaTracker}. Also record this state as the last committed state.
   */
  private void handleDestinationEmittedState(final AirbyteStateMessage stateMessage) {
    stateAggregator.ingest(stateMessage);
    destinationOutputState.set(stateAggregator.getAggregated());

    syncStatsTracker.updateDestinationStateStats(stateMessage);
  }

  /**
   * When a connector emits a trace message, check the type and call the correct function. If it is an
   * error trace message, add it to the list of errorTraceMessages for the connector type
   */
  private void handleEmittedTrace(final AirbyteTraceMessage traceMessage, final AirbyteMessageOrigin airbyteMessageOrigin) {
    switch (traceMessage.getType()) {
      case ESTIMATE -> handleEmittedEstimateTrace(traceMessage.getEstimate());
      case ERROR -> handleEmittedErrorTrace(traceMessage, airbyteMessageOrigin);
      case STREAM_STATUS -> log.debug("Stream status trace message not handled by message tracker: {}", traceMessage);
      default -> log.warn("Invalid message type for trace message: {}", traceMessage);
    }
  }

  private void handleEmittedErrorTrace(final AirbyteTraceMessage errorTraceMessage, final AirbyteMessageOrigin airbyteMessageOrigin) {
    if (airbyteMessageOrigin.equals(AirbyteMessageOrigin.DESTINATION)) {
      destinationErrorTraceMessages.add(errorTraceMessage);
    } else if (airbyteMessageOrigin.equals(AirbyteMessageOrigin.SOURCE)) {
      sourceErrorTraceMessages.add(errorTraceMessage);
    }
  }

  /**
   * There are several assumptions here:
   * <p>
   * - Assume the estimate is a whole number and not a sum i.e. each estimate replaces the previous
   * estimate.
   * <p>
   * - Sources cannot emit both STREAM and SYNC estimates in a same sync. Error out if this happens.
   */
  @SuppressWarnings("PMD.AvoidDuplicateLiterals")
  private void handleEmittedEstimateTrace(final AirbyteEstimateTraceMessage estimate) {
    syncStatsTracker.updateEstimates(estimate);
  }

  @Override
  public AirbyteTraceMessage getFirstSourceErrorTraceMessage() {
    if (!sourceErrorTraceMessages.isEmpty()) {
      return sourceErrorTraceMessages.get(0);
    } else {
      return null;
    }
  }

  @Override
  public AirbyteTraceMessage getFirstDestinationErrorTraceMessage() {
    if (!destinationErrorTraceMessages.isEmpty()) {
      return destinationErrorTraceMessages.get(0);
    } else {
      return null;
    }
  }

  @Override
  public FailureReason errorTraceMessageFailure(final Long jobId, final Integer attempt) {
    final AirbyteTraceMessage sourceMessage = getFirstSourceErrorTraceMessage();
    final AirbyteTraceMessage destinationMessage = getFirstDestinationErrorTraceMessage();

    if (sourceMessage == null && destinationMessage == null) {
      return null;
    }

    if (destinationMessage == null) {
      return FailureHelper.sourceFailure(sourceMessage, jobId, attempt);
    }

    if (sourceMessage == null) {
      return FailureHelper.destinationFailure(destinationMessage, jobId, attempt);
    }

    if (sourceMessage.getEmittedAt() <= destinationMessage.getEmittedAt()) {
      return FailureHelper.sourceFailure(sourceMessage, jobId, attempt);
    } else {
      return FailureHelper.destinationFailure(destinationMessage, jobId, attempt);
    }

  }

  @Override
  public Optional<State> getSourceOutputState() {
    return Optional.ofNullable(sourceOutputState.get());
  }

  @Override
  public Optional<State> getDestinationOutputState() {
    return Optional.ofNullable(destinationOutputState.get());
  }

  @Override
  public SyncStatsTracker getSyncStatsTracker() {
    return syncStatsTracker;
  }

  private void logMessageAsJSON(final String caller, final AirbyteMessage message) {
    if (!featureFlagLogConnectorMsgs) {
      return;
    }

    log.info(caller + " message | " + Jsons.serialize(message));
  }

}
