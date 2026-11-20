import { addons } from "storybook/preview-api";
import { panelResult } from "../dist/storybook-model.js";
import { PANEL_EVENT } from "./constants.js";

/** Send the story's color-vision cards to the ColorWarning panel. */
const withColorWarning = (storyFn, context) => {
  addons.getChannel().emit(PANEL_EVENT, panelResult(context.parameters?.colorwarning));
  return storyFn();
};

export default {
  decorators: [withColorWarning],
};
