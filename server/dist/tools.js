import { DOOR_ORDER } from "./doors.js";
export async function registerDoorTools(server, ctx) {
    // SCAFFOLD: walk-order inspector. Replace door-by-door as the real
    // tools land. Exists so transport wiring can be tested before any
    // door has its final shape.
    server.tool("door_status", "Scaffold: reports the door walk order and test-mode state. Will be removed as the real doors land.", {}, async (args) => ({
        content: [
            {
                type: "text",
                text: `Doors: ${DOOR_ORDER.join(" → ")}\nTest-mode artifact logging: ${ctx.testLogging ? "ON" : "OFF"}\nState: scaffold — no doors registered yet.`,
            },
        ],
    }));
}
