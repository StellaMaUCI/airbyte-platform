import React, { ReactNode } from "react";
import { useFieldArray } from "react-hook-form";
import { FormattedMessage, useIntl } from "react-intl";

import GroupControls from "components/GroupControls";
import { ControlLabels } from "components/LabeledControl";
import { Button } from "components/ui/Button";
import { FlexContainer, FlexItem } from "components/ui/Flex";

import { BuilderFieldWithInputs } from "./BuilderFieldWithInputs";
import { getLabelAndTooltip } from "./manifestHelpers";
import { RemoveButton } from "./RemoveButton";

interface KeyValueInputProps {
  path: string;
  onRemove: () => void;
}

const KeyValueInput: React.FC<KeyValueInputProps> = ({ onRemove, path }) => {
  const { formatMessage } = useIntl();
  return (
    <FlexContainer gap="xl" alignItems="flex-start">
      <FlexItem grow>
        <BuilderFieldWithInputs
          label={formatMessage({ id: "connectorBuilder.key" })}
          type="string"
          path={`${path}.0`}
        />
      </FlexItem>
      <FlexItem grow>
        <BuilderFieldWithInputs
          label={formatMessage({ id: "connectorBuilder.value" })}
          type="string"
          path={`${path}.1`}
        />
      </FlexItem>
      <RemoveButton onClick={onRemove} />
    </FlexContainer>
  );
};

interface KeyValueListFieldProps {
  path: string;
  label?: string;
  tooltip?: ReactNode;
  manifestPath?: string;
}

export const KeyValueListField: React.FC<KeyValueListFieldProps> = ({ path, label, tooltip, manifestPath }) => {
  const { label: finalLabel, tooltip: finalTooltip } = getLabelAndTooltip(label, tooltip, manifestPath, path);
  const { fields: keyValueList, append, remove } = useFieldArray({ name: path });

  return (
    <GroupControls
      label={<ControlLabels label={finalLabel} infoTooltipContent={finalTooltip} />}
      control={
        <Button type="button" variant="secondary" onClick={() => append([["", ""]])}>
          <FormattedMessage id="connectorBuilder.addKeyValue" />
        </Button>
      }
    >
      {keyValueList.map((keyValue, keyValueIndex) => (
        <KeyValueInput
          key={keyValue.id}
          path={`${path}.${keyValueIndex}`}
          onRemove={() => {
            remove(keyValueIndex);
          }}
        />
      ))}
    </GroupControls>
  );
};
