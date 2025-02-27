import { Form, Formik, FormikHelpers, useFormikContext } from "formik";
import React, { useCallback, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useLocation } from "react-router-dom";
import { useUnmount } from "react-use";

import { ConnectionFormFields } from "components/connection/ConnectionForm/ConnectionFormFields";
import EditControls from "components/connection/ConnectionForm/EditControls";
import {
  FormikConnectionFormValues,
  useConnectionValidationSchema,
} from "components/connection/ConnectionForm/formConfig";
import { useRefreshSourceSchemaWithConfirmationOnDirty } from "components/connection/ConnectionForm/refreshSourceSchemaWithConfirmationOnDirty";
import { SchemaChangeBackdrop } from "components/connection/ConnectionForm/SchemaChangeBackdrop";
import { SchemaError } from "components/connection/CreateConnectionForm/SchemaError";
import LoadingSchema from "components/LoadingSchema";
import { FlexContainer } from "components/ui/Flex";
import { Message } from "components/ui/Message/Message";

import { toWebBackendConnectionUpdate } from "core/domain/connection";
import { SchemaChange } from "core/request/AirbyteClient";
import { getFrequencyFromScheduleData } from "core/services/analytics";
import { Action, Namespace } from "core/services/analytics";
import { PageTrackingCodes, useAnalyticsService, useTrackPage } from "core/services/analytics";
import { useConfirmCatalogDiff } from "hooks/connection/useConfirmCatalogDiff";
import { useSchemaChanges } from "hooks/connection/useSchemaChanges";
import { useConnectionEditService } from "hooks/services/ConnectionEdit/ConnectionEditService";
import {
  tidyConnectionFormValues,
  useConnectionFormService,
} from "hooks/services/ConnectionForm/ConnectionFormService";
import { useModalService } from "hooks/services/Modal";
import { useConnectionService, ValuesProps } from "hooks/services/useConnectionHook";
import { useCurrentWorkspaceId } from "services/workspaces/WorkspacesService";
import { equal } from "utils/objects";

import styles from "./ConnectionReplicationPage.module.scss";
import { ResetWarningModal } from "./ResetWarningModal";

const ValidateFormOnSchemaRefresh: React.FC = () => {
  const { schemaHasBeenRefreshed } = useConnectionEditService();
  const { setTouched } = useFormikContext();

  useEffect(() => {
    if (schemaHasBeenRefreshed) {
      setTouched({ syncCatalog: true }, true);
    }
  }, [setTouched, schemaHasBeenRefreshed]);

  return null;
};

const SchemaChangeMessage: React.FC<{ dirty: boolean; schemaChange: SchemaChange }> = ({ dirty, schemaChange }) => {
  const { hasNonBreakingSchemaChange, hasBreakingSchemaChange } = useSchemaChanges(schemaChange);
  const { schemaHasBeenRefreshed } = useConnectionEditService();
  const { refreshSchema } = useConnectionFormService();
  const refreshWithConfirm = useRefreshSourceSchemaWithConfirmationOnDirty(dirty);

  if (schemaHasBeenRefreshed) {
    return null;
  } // todo: note in review that this is a behavior change

  if (hasNonBreakingSchemaChange) {
    return (
      <Message
        type="warning"
        text={<FormattedMessage id="connection.schemaChange.nonBreaking" />}
        actionBtnText={<FormattedMessage id="connection.schemaChange.reviewAction" />}
        onAction={refreshSchema}
        data-testid="schemaChangesDetected"
      />
    );
  }

  if (hasBreakingSchemaChange) {
    return (
      <Message
        type="error"
        text={<FormattedMessage id="connection.schemaChange.breaking" />}
        actionBtnText={<FormattedMessage id="connection.schemaChange.reviewAction" />}
        onAction={refreshWithConfirm}
        data-testid="schemaChangesDetected"
      />
    );
  }
  return null;
};

export const ConnectionReplicationPage: React.FC = () => {
  const analyticsService = useAnalyticsService();
  const connectionService = useConnectionService();
  const workspaceId = useCurrentWorkspaceId();

  const { formatMessage } = useIntl();
  const { openModal } = useModalService();

  const [saved, setSaved] = useState(false);

  const { connection, schemaRefreshing, schemaHasBeenRefreshed, updateConnection, discardRefreshedSchema } =
    useConnectionEditService();
  const { initialValues, mode, schemaError, getErrorMessage, setSubmitError, refreshSchema } =
    useConnectionFormService();
  const validationSchema = useConnectionValidationSchema({ mode });

  useTrackPage(PageTrackingCodes.CONNECTIONS_ITEM_REPLICATION);

  const saveConnection = useCallback(
    async (
      values: ValuesProps,
      { skipReset, catalogHasChanged }: { skipReset: boolean; catalogHasChanged: boolean }
    ) => {
      const connectionAsUpdate = toWebBackendConnectionUpdate(connection);

      await updateConnection({
        ...connectionAsUpdate,
        ...values,
        connectionId: connection.connectionId,
        skipReset,
      });

      if (catalogHasChanged) {
        // TODO (https://github.com/airbytehq/airbyte/issues/17666): Move this into a useTrackChangedCatalog method (name pending) post Vlad's analytics hook work
        analyticsService.track(Namespace.CONNECTION, Action.EDIT_SCHEMA, {
          actionDescription: "Connection saved with catalog changes",
          connector_source: connection.source.sourceName,
          connector_source_definition_id: connection.source.sourceDefinitionId,
          connector_destination: connection.destination.destinationName,
          connector_destination_definition_id: connection.destination.destinationDefinitionId,
          frequency: getFrequencyFromScheduleData(connection.scheduleData),
        });
      }
    },
    [analyticsService, connection, updateConnection]
  );

  const onFormSubmit = useCallback(
    async (values: FormikConnectionFormValues, _: FormikHelpers<FormikConnectionFormValues>) => {
      const formValues = tidyConnectionFormValues(values, workspaceId, validationSchema, connection.operations);

      // Check if the user refreshed the catalog and there was any change in a currently enabled stream
      const hasDiffInEnabledStream = connection.catalogDiff?.transforms.some(({ streamDescriptor }) => {
        // Find the stream for this transform in our form's syncCatalog
        const stream = formValues.syncCatalog.streams.find(
          ({ stream }) => streamDescriptor.name === stream?.name && streamDescriptor.namespace === stream.namespace
        );
        return stream?.config?.selected;
      });

      // Check if the user made any modifications to enabled streams compared to the ones in the latest connection
      // e.g. changed the sync mode of an enabled stream
      const hasUserChangesInEnabledStreams = !equal(
        formValues.syncCatalog.streams.filter((s) => s.config?.selected),
        connection.syncCatalog.streams.filter((s) => s.config?.selected)
      );

      const catalogHasChanged = hasDiffInEnabledStream || hasUserChangesInEnabledStreams;

      setSubmitError(null);

      // Whenever the catalog changed show a warning to the user, that we're about to reset their data.
      // Given them a choice to opt-out in which case we'll be sending skipReset: true to the update
      // endpoint.
      try {
        if (catalogHasChanged) {
          const stateType = await connectionService.getStateType(connection.connectionId);
          const result = await openModal<boolean>({
            title: formatMessage({ id: "connection.resetModalTitle" }),
            size: "md",
            content: (props) => <ResetWarningModal {...props} stateType={stateType} />,
          });
          if (result.type !== "canceled") {
            // Save the connection taking into account the correct skipReset value from the dialog choice.
            await saveConnection(formValues, {
              skipReset: !result.reason,
              catalogHasChanged,
            });
          } else {
            // We don't want to set saved to true or schema has been refreshed to false.
            return;
          }
        } else {
          // The catalog hasn't changed. We don't need to ask for any confirmation and can simply save.
          await saveConnection(formValues, { skipReset: true, catalogHasChanged });
        }

        setSaved(true);
      } catch (e) {
        setSubmitError(e);
      }
    },
    [
      workspaceId,
      validationSchema,
      connection.operations,
      connection.catalogDiff?.transforms,
      connection.syncCatalog.streams,
      connection.connectionId,
      setSubmitError,
      connectionService,
      openModal,
      formatMessage,
      saveConnection,
    ]
  );

  useConfirmCatalogDiff();

  useUnmount(() => {
    discardRefreshedSchema();
  });

  const { state } = useLocation();
  useEffect(() => {
    if (typeof state === "object" && state && "triggerRefreshSchema" in state && state.triggerRefreshSchema) {
      refreshSchema();
    }
  }, [refreshSchema, state]);

  return (
    <div className={styles.content}>
      {schemaError && !schemaRefreshing ? (
        <SchemaError schemaError={schemaError} />
      ) : !schemaRefreshing && connection ? (
        <Formik
          initialStatus={{ editControlsVisible: true }}
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={onFormSubmit}
          enableReinitialize
        >
          {({ isSubmitting, isValid, dirty, resetForm, status, errors }) => (
            <FlexContainer direction="column">
              <SchemaChangeMessage dirty={dirty} schemaChange={connection.schemaChange} />
              <SchemaChangeBackdrop>
                <Form>
                  <ValidateFormOnSchemaRefresh />
                  <ConnectionFormFields isSubmitting={isSubmitting} dirty={dirty || schemaHasBeenRefreshed} />
                  <div className={styles.editControlsContainer}>
                    <EditControls
                      hidden={!status.editControlsVisible}
                      isSubmitting={isSubmitting}
                      submitDisabled={!isValid}
                      dirty={dirty}
                      resetForm={async () => {
                        resetForm();
                        discardRefreshedSchema();
                      }}
                      successMessage={saved && !dirty && <FormattedMessage id="form.changesSaved" />}
                      errorMessage={getErrorMessage(isValid, dirty, errors)}
                      enableControls={schemaHasBeenRefreshed || dirty}
                    />
                  </div>
                </Form>
              </SchemaChangeBackdrop>
            </FlexContainer>
          )}
        </Formik>
      ) : (
        <LoadingSchema />
      )}
    </div>
  );
};
