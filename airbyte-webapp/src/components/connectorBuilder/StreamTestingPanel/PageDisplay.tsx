import { Tab } from "@headlessui/react";
import classNames from "classnames";
import React, { ReactNode, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { FlexContainer } from "components/ui/Flex";
import { Text } from "components/ui/Text";
import { InfoTooltip } from "components/ui/Tooltip";

import { StreamReadInferredSchema, StreamReadSlicesItemPagesItem } from "core/request/ConnectorBuilderClient";
import {
  useConnectorBuilderFormState,
  useConnectorBuilderTestRead,
} from "services/connectorBuilder/ConnectorBuilderStateService";

import styles from "./PageDisplay.module.scss";
import { SchemaDiffView } from "./SchemaDiffView";
import { SchemaConflictIndicator } from "../SchemaConflictIndicator";
import { useBuilderWatch } from "../types";
import { formatJson } from "../utils";

interface PageDisplayProps {
  page: StreamReadSlicesItemPagesItem;
  inferredSchema?: StreamReadInferredSchema;
  className?: string;
}

interface TabData {
  title: ReactNode;
  key: string;
  content: string;
}

export const PageDisplay: React.FC<PageDisplayProps> = ({ page, className, inferredSchema }) => {
  const { formatMessage } = useIntl();

  const { editorView } = useConnectorBuilderFormState();
  const { testStreamIndex, streamRead } = useConnectorBuilderTestRead();
  const value = useBuilderWatch(`streams.${testStreamIndex}.schema`);

  const formattedRecords = useMemo(() => formatJson(page.records), [page.records]);
  const formattedRequest = useMemo(() => formatJson(page.request), [page.request]);
  const formattedResponse = useMemo(() => {
    if (!page.response || !page.response.body) {
      return "";
    }
    let parsedBody: unknown;
    try {
      // body is a string containing JSON most of the time, but not always.
      // Attempt to parse and fall back to the raw string if unsuccessfull.
      parsedBody = JSON.parse(page.response.body);
    } catch {
      parsedBody = page.response.body;
    }

    const unpackedBodyResponse = {
      ...page.response,
      body: parsedBody,
    };
    return formatJson(unpackedBodyResponse);
  }, [page.response]);
  const formattedSchema = useMemo(() => inferredSchema && formatJson(inferredSchema, true), [inferredSchema]);

  let defaultTabIndex = 0;
  const tabs: TabData[] = [
    {
      title: (
        <>
          {`${formatMessage({ id: "connectorBuilder.recordsTab" })} (${page.records.length})`}
          {!streamRead.isFetching && streamRead.data && streamRead.data.test_read_limit_reached && (
            <InfoTooltip>
              <FormattedMessage id="connectorBuilder.streamTestLimitReached" />
            </InfoTooltip>
          )}
        </>
      ),
      key: "records",
      content: formattedRecords,
    },
  ];
  if (page.request) {
    tabs.push({
      title: formatMessage({ id: "connectorBuilder.requestTab" }),
      key: "request",
      content: formattedRequest,
    });
  }
  if (page.response) {
    tabs.push({
      title: formatMessage({ id: "connectorBuilder.responseTab" }),
      key: "response",
      content: formattedResponse,
    });

    if (page.response.status >= 400) {
      defaultTabIndex = tabs.length - 1;
    }
  }

  return (
    <div className={classNames(className)}>
      <Tab.Group defaultIndex={defaultTabIndex}>
        <Tab.List className={styles.tabList}>
          {tabs.map((tab) => (
            <Tab className={styles.tab} key={tab.key}>
              {({ selected }) => (
                <Text className={classNames(styles.tabTitle, { [styles.selected]: selected })} size="xs" align="center">
                  {tab.title}
                </Text>
              )}
            </Tab>
          ))}
          {inferredSchema && (
            <Tab className={styles.tab} data-testid="tag-tab-detected-schema">
              {({ selected }) => (
                <Text className={classNames(styles.tabTitle, { [styles.selected]: selected })} as="div" size="xs">
                  <FlexContainer direction="row" justifyContent="center">
                    {formatMessage({ id: "connectorBuilder.schemaTab" })}
                    {editorView === "ui" && value !== formattedSchema && <SchemaConflictIndicator />}
                  </FlexContainer>
                </Text>
              )}
            </Tab>
          )}
        </Tab.List>
        <Tab.Panels className={styles.tabPanelContainer}>
          {tabs.map((tab) => (
            <Tab.Panel className={styles.tabPanel} key={tab.key}>
              <pre>{tab.content}</pre>
            </Tab.Panel>
          ))}
          {inferredSchema && (
            <Tab.Panel className={styles.tabPanel}>
              <SchemaDiffView inferredSchema={inferredSchema} />
            </Tab.Panel>
          )}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};
