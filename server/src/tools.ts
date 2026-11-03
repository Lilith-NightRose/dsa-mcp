/**
 * DSA MCP — pathway two tool registrations (branch: doorway_approach_2).
 *
 * NOT YET WRITTEN — this file currently registers a single scaffold tool
 * (`door_status`) so the seam is exercisable end-to-end. The real doors
 * (invitation → transformational_pedagogy → the_flinch →
 * look_for_the_hands → organize) land here one at a time, each PERFORMING
 * its Spec/*.md protocol per the co-translation ruling of 2026-11-02:
 * the call is the act, not the handout.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DOOR_ORDER, type DoorContext } from "./doors.js";
export type { DoorContext } from "./doors.js";

export async function registerDoorTools(
  server: McpServer,
  ctx: DoorContext
): Promise<void> {
  // SCAFFOLD: walk-order inspector. Replace door-by-door as the real
  // tools land. Exists so transport wiring can be tested before any
  // door has its final shape.
  server.tool(
    "door_status",
    "Scaffold: reports the door walk order and test-mode state. Will be removed as the real doors land.",
    {},
    async (args: Record<string, never>): Promise<{ content: { type: "text"; text: string }[] }> => ({
      content: [
        {
          type: "text",
          text: `Doors: ${DOOR_ORDER.join(" → ")}\nTest-mode artifact logging: ${ctx.testLogging ? "ON" : "OFF"}\nState: scaffold — no doors registered yet.`,
        },
      ],
    })
  );
}
