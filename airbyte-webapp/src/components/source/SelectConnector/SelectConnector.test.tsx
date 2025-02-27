import userEvent from "@testing-library/user-event";

import { render } from "test-utils";
import { mockSourceDefinition } from "test-utils/mock-data/mockSource";
import { mockWorkspace } from "test-utils/mock-data/mockWorkspace";

import { SelectConnector } from "./SelectConnector";

const mockTrackSelectConnector = jest.fn();

jest.mock("./useTrackSelectConnector", () => ({
  useTrackSelectConnector: () => mockTrackSelectConnector,
}));

jest.mock("services/workspaces/WorkspacesService", () => ({
  useCurrentWorkspace: () => mockWorkspace,
}));

describe(`${SelectConnector.name}`, () => {
  it("Tracks an analytics event when a connector is selected", async () => {
    const { getByText } = await render(
      <SelectConnector
        connectorType="source"
        connectorDefinitions={[mockSourceDefinition]}
        headingKey="mockHeading"
        onSelectConnectorDefinition={jest.fn()}
      />
    );

    const connectorButton = getByText(mockSourceDefinition.name);
    userEvent.click(connectorButton);

    expect(mockTrackSelectConnector).toHaveBeenCalledTimes(1);
  });
});
