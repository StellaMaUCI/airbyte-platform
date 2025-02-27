import classNames from "classnames";
import uniqueId from "lodash/uniqueId";
import { HTMLInputTypeAttribute, ReactNode, useState } from "react";
import React from "react";
import { FieldError, Path, get, useFormState } from "react-hook-form";
import { useIntl } from "react-intl";

import { DatePickerProps } from "components/ui/DatePicker/DatePicker";
import { InputProps } from "components/ui/Input";
import { ListBoxProps, Option } from "components/ui/ListBox";
import { SwitchProps } from "components/ui/Switch/Switch";
import { Text } from "components/ui/Text";
import { InfoTooltip } from "components/ui/Tooltip";

import { DatepickerWrapper } from "./DatepickerWrapper";
import { FormValues } from "./Form";
import styles from "./FormControl.module.scss";
import { InputWrapper } from "./InputWrapper";
import { SelectWrapper } from "./SelectWrapper";
import { SwitchWrapper } from "./SwitchWrapper";

type ControlProps<T extends FormValues> =
  | SelectControlProps<T>
  | InputControlProps<T>
  | DatepickerControlProps<T>
  | SwitchControlProps<T>;

interface ControlBaseProps<T extends FormValues> {
  /**
   * fieldType determines what form element is rendered. Depending on the chosen fieldType, additional props may be optional or required.
   */
  fieldType: "input" | "date" | "dropdown" | "switch";
  /**
   * The field name must match any provided default value or validation schema.
   */
  name: Path<T>;
  /**
   * A label that is displayed above the form control
   */
  label: string;
  /**
   * A tooltip that appears next to the form label
   */
  labelTooltip?: ReactNode;
  /**
   * An optional description that appears under the label
   */
  description?: string | ReactNode;
  hasError?: boolean;
  controlId?: string;
  inline?: boolean;
}

/**
 * These properties are only relevant at the control level. They can therefore be omitted before passing along to the underlying form input.
 */
export type OmittableProperties = "fieldType" | "label" | "labelTooltip" | "description" | "inline";

export interface InputControlProps<T extends FormValues> extends ControlBaseProps<T>, Omit<InputProps, "name"> {
  fieldType: "input";
  type?: HTMLInputTypeAttribute;
}

export interface DatepickerControlProps<T extends FormValues>
  extends ControlBaseProps<T>,
    Omit<DatePickerProps, "name" | "value" | "onChange"> {
  fieldType: "date";
  /**
   * The desired format for the date string:
   * - **date**       *YYYY-MM-DD* (default)
   * - **date-time**  *YYYY-MM-DDTHH:mm:ssZ*
   */
  format?: "date" | "date-time";
}

export interface SelectControlProps<T extends FormValues>
  extends ControlBaseProps<T>,
    Omit<ListBoxProps<string>, "onSelect" | "selectedValue"> {
  fieldType: "dropdown";
  options: Array<Option<string>>;
}

export interface SwitchControlProps<T extends FormValues> extends ControlBaseProps<T>, Omit<SwitchProps, "name"> {
  fieldType: "switch";
}

export const FormControl = <T extends FormValues>({
  label,
  labelTooltip,
  description,
  inline = false,
  ...props
}: ControlProps<T>) => {
  // only retrieve new form state if form state of current field has changed
  const { errors } = useFormState<T>({ name: props.name });
  const error = get(errors, props.name);
  const [controlId] = useState(`input-control-${uniqueId()}`);

  // Properties to pass to the underlying control
  const controlProps = {
    ...props,
    hasError: error,
    controlId,
  };

  function renderControl() {
    if (controlProps.fieldType === "input") {
      // After narrowing controlProps, we need to strip controlProps.fieldType as it's no longer needed
      const { fieldType, ...withoutFieldType } = controlProps;
      return <InputWrapper {...withoutFieldType} />;
    }

    if (controlProps.fieldType === "date") {
      const { fieldType, ...withoutFieldType } = controlProps;
      return <DatepickerWrapper {...withoutFieldType} />;
    }

    if (controlProps.fieldType === "dropdown") {
      const { fieldType, ...withoutFieldType } = controlProps;
      return <SelectWrapper {...withoutFieldType} />;
    }

    if (controlProps.fieldType === "switch") {
      const { fieldType, ...withoutFieldType } = controlProps;
      return <SwitchWrapper {...withoutFieldType} />;
    }

    throw new Error(`No matching form input found for type: ${props.fieldType}`);
  }

  return (
    <div className={classNames(styles.control, { [styles["control--inline"]]: inline })}>
      <FormLabel description={description} label={label} labelTooltip={labelTooltip} htmlFor={controlId} />
      <div className={styles.control__input}>{renderControl()}</div>
      {error && <FormControlError error={error} />}
    </div>
  );
};

interface FormLabelProps {
  description?: string | ReactNode;
  label: string;
  labelTooltip?: ReactNode;
  htmlFor: string;
  inline?: boolean;
}

export const FormLabel: React.FC<FormLabelProps> = ({ description, label, labelTooltip, htmlFor }) => {
  return (
    <label className={styles.control__label} htmlFor={htmlFor}>
      <Text size="lg">
        {label}
        {labelTooltip && <InfoTooltip placement="top-start">{labelTooltip}</InfoTooltip>}
      </Text>
      {description && <Text className={styles.control__description}>{description}</Text>}
    </label>
  );
};

interface ControlErrorProps {
  error: FieldError;
}

export const FormControlError: React.FC<ControlErrorProps> = ({ error }) => {
  const { formatMessage } = useIntl();

  // It's possible that an error has no message, but in that case there's no point in rendering anything
  if (!error.message) {
    return null;
  }

  return (
    <div className={styles.control__errorWrapper}>
      <p className={styles.control__errorMessage}>{formatMessage({ id: error.message })}</p>
    </div>
  );
};
