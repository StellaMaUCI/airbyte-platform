/*
 * Copyright (c) 2023 Airbyte, Inc., all rights reserved.
 */

package io.airbyte.workers.temporal.scheduling.testcheckworkflow;

import io.airbyte.commons.temporal.scheduling.CheckConnectionWorkflow;
import io.airbyte.config.ActorType;
import io.airbyte.config.ConnectorJobOutput;
import io.airbyte.config.ConnectorJobOutput.OutputType;
import io.airbyte.config.StandardCheckConnectionInput;
import io.airbyte.config.StandardCheckConnectionOutput;
import io.airbyte.config.StandardCheckConnectionOutput.Status;
import io.airbyte.persistence.job.models.IntegrationLauncherConfig;
import io.airbyte.persistence.job.models.JobRunConfig;

@SuppressWarnings("MissingJavadocType")
public class CheckConnectionSourceSuccessOnlyWorkflow implements CheckConnectionWorkflow {

  @Override
  public ConnectorJobOutput run(JobRunConfig jobRunConfig,
                                IntegrationLauncherConfig launcherConfig,
                                StandardCheckConnectionInput connectionConfiguration) {
    if (connectionConfiguration.getActorType().equals(ActorType.SOURCE)) {
      return new ConnectorJobOutput().withOutputType(OutputType.CHECK_CONNECTION)
          .withCheckConnection(new StandardCheckConnectionOutput().withStatus(Status.SUCCEEDED).withMessage("check worked"));
    } else {
      return new ConnectorJobOutput().withOutputType(OutputType.CHECK_CONNECTION)
          .withCheckConnection(new StandardCheckConnectionOutput().withStatus(Status.FAILED).withMessage("nope"));
    }
  }

}
