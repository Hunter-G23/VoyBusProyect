import React from "react";
import { Catalog } from "./Catalog";

export type LinesProps = { onTrip: () => void };
export function Lines({ onTrip }: LinesProps) {
  return <Catalog onTrip={onTrip} />;
}
