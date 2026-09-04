"use client";

import { forwardRef } from "react";
import ForceGraph3D from "react-force-graph-3d";

/**
 * next/dynamic does not forward refs, so this wrapper receives the parent's
 * ref via a regular prop and hands it to react-force-graph directly.
 */
const FG3DWrapper = forwardRef<any, any>(function FG3DWrapper(props, _ref) {
  const { fgRef, ...rest } = props;
  return <ForceGraph3D ref={fgRef} {...rest} />;
});

export default FG3DWrapper;
