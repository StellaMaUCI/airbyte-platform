import { Dialog } from "@headlessui/react";
import React from "react";

import { Overlay } from "components/ui/Overlay";

import { AirbyteStream } from "core/request/AirbyteClient";

import styles from "./StreamDetailsPanel.module.scss";
import { StreamPanelHeader } from "./StreamPanelHeader";
import { StreamFieldsTable, StreamFieldsTableProps } from "../StreamFieldsTable/StreamFieldsTable";

interface StreamDetailsPanelProps extends StreamFieldsTableProps {
  disabled?: boolean;
  onClose: () => void;
  onSelectedChange: () => void;
  stream?: AirbyteStream;
  handleFieldToggle: (fieldPath: string[], isSelected: boolean) => void;
  toggleAllFieldsSelected: () => void;
}

export const StreamDetailsPanel: React.FC<StreamDetailsPanelProps> = ({
  stream,
  config,
  disabled,
  handleFieldToggle,
  onPkSelect,
  onCursorSelect,
  onClose,
  onSelectedChange,
  shouldDefinePk,
  shouldDefineCursor,
  isCursorDefinitionSupported,
  isPKDefinitionSupported,
  syncSchemaFields,
  toggleAllFieldsSelected,
}) => {
  return (
    <Dialog className={styles.dialog} open onClose={onClose}>
      <Overlay />
      <Dialog.Panel className={styles.container} data-testid="stream-details">
        <StreamPanelHeader
          stream={stream}
          config={config}
          disabled={disabled}
          onClose={onClose}
          onSelectedChange={onSelectedChange}
        />
        <div className={styles.tableContainer}>
          <StreamFieldsTable
            config={config}
            syncSchemaFields={syncSchemaFields}
            handleFieldToggle={handleFieldToggle}
            onCursorSelect={onCursorSelect}
            onPkSelect={onPkSelect}
            shouldDefinePk={shouldDefinePk}
            shouldDefineCursor={shouldDefineCursor}
            isCursorDefinitionSupported={isCursorDefinitionSupported}
            isPKDefinitionSupported={isPKDefinitionSupported}
            toggleAllFieldsSelected={toggleAllFieldsSelected}
          />
        </div>
      </Dialog.Panel>
    </Dialog>
  );
};
