import classnames from "classnames";
import React from "react";
import { FormattedMessage } from "react-intl";

import { Button } from "components/ui/Button";
import { Text } from "components/ui/Text";

import { ConnectorDefinitionSpecification, ConnectorSpecification } from "core/domain/connector";
import { ConnectorIds } from "utils/connectors";

import styles from "./AuthButton.module.scss";
import GoogleAuthButton from "./GoogleAuthButton";
import QuickBooksAuthButton from "./QuickBooksAuthButton";
import { useFormikOauthAdapter } from "./useOauthFlowAdapter";
import { FlexContainer } from "../../../../../../components/ui/Flex";
import { useConnectorForm } from "../../../connectorFormContext";
import { useAuthentication } from "../../../useAuthentication";

function isGoogleConnector(connectorDefinitionId: string): boolean {
  return (
    [
      ConnectorIds.Sources.GoogleAds,
      ConnectorIds.Sources.GoogleAnalyticsUniversalAnalytics,
      ConnectorIds.Sources.GoogleDirectory,
      ConnectorIds.Sources.GoogleSearchConsole,
      ConnectorIds.Sources.GoogleSheets,
      ConnectorIds.Sources.GoogleWorkspaceAdminReports,
      ConnectorIds.Sources.YouTubeAnalytics,
      ConnectorIds.Destinations.GoogleSheets,
      // TODO: revert me
      ConnectorIds.Sources.YouTubeAnalyticsBusiness,
      //
    ] as string[]
  ).includes(connectorDefinitionId);
}

function getButtonComponent(connectorDefinitionId: string) {
  if (isGoogleConnector(connectorDefinitionId)) {
    return GoogleAuthButton;
  }
  if (connectorDefinitionId === ConnectorIds.Sources.QuickBooks) {
    return QuickBooksAuthButton;
  }
  return Button;
}

function getAuthenticateMessageId(connectorDefinitionId: string): string {
  if (isGoogleConnector(connectorDefinitionId)) {
    return "connectorForm.signInWithGoogle";
  }
  return "connectorForm.authenticate";
}

export const AuthButton: React.FC<{
  selectedConnectorDefinitionSpecification: ConnectorDefinitionSpecification;
}> = ({ selectedConnectorDefinitionSpecification }) => {
  const { selectedConnectorDefinition } = useConnectorForm();

  const { hiddenAuthFieldErrors } = useAuthentication();
  const authRequiredError = Object.values(hiddenAuthFieldErrors).includes("form.empty.error");

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { loading, done, run } = useFormikOauthAdapter(
    selectedConnectorDefinitionSpecification,
    selectedConnectorDefinition
  );

  if (!selectedConnectorDefinition) {
    console.error("Entered non-auth flow while no supported connector is selected");
    return null;
  }

  const definitionId = ConnectorSpecification.id(selectedConnectorDefinitionSpecification);
  const Component = getButtonComponent(definitionId);

  const messageStyle = classnames(styles.message, {
    [styles.error]: authRequiredError,
    [styles.success]: !authRequiredError,
  });
  const buttonLabel = done ? (
    <FormattedMessage id="connectorForm.reauthenticate" />
  ) : (
    <FormattedMessage
      id={getAuthenticateMessageId(definitionId)}
      values={{ connector: selectedConnectorDefinition.name }}
    />
  );
  return (
    <FlexContainer alignItems="center">
      <Component isLoading={loading} type="button" data-testid="oauth-button" onClick={run}>
        {buttonLabel}
      </Component>
      {authRequiredError && (
        <Text as="div" size="lg" className={messageStyle}>
          <FormattedMessage id="connectorForm.authenticate.required" />
        </Text>
      )}
    </FlexContainer>
  );
};
