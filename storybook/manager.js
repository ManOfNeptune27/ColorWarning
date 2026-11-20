import React, { useState } from "react";
import { AddonPanel } from "storybook/internal/components";
import { addons, types, useChannel } from "storybook/manager-api";
import { ADDON_ID, PANEL_EVENT, PANEL_ID, PARAM_KEY } from "./constants.js";

function Panel({ active }) {
  const [html, setHtml] = useState("<p style=\"margin:12px;color:#222;font:13px/1.4 sans-serif\">Open a story to check its colors.</p>");
  useChannel({
    [PANEL_EVENT]: (payload) => {
      if (payload !== null && typeof payload === "object" && typeof payload.html === "string") setHtml(payload.html);
    },
  });
  return React.createElement(
    AddonPanel,
    { active: Boolean(active) },
    React.createElement("div", { dangerouslySetInnerHTML: { __html: html } }),
  );
}

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: "ColorWarning",
    paramKey: PARAM_KEY,
    match: ({ viewMode }) => viewMode === "story",
    render: ({ active }) => React.createElement(Panel, { active }),
  });
});
