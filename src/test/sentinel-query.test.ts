import { describe, expect, it } from "vitest";
import { INITIAL_CAMERAS, parseQuery } from "@/lib/api";

describe("sentinel query parsing", () => {
  it("parses object class, colour and known location", () => {
    const parsed = parseQuery("Red car at main gate", INITIAL_CAMERAS, []);
    expect(parsed.object_class).toBe("Car");
    expect(parsed.attributes).toContain("red");
    expect(parsed.location).toBe("Main Gate");
    expect(parsed.cameras).toEqual(["CAM_01"]);
  });

  it("parses person queries without a location", () => {
    const parsed = parseQuery("Person in red shirt", INITIAL_CAMERAS, []);
    expect(parsed.object_class).toBe("Person");
    expect(parsed.location).toBeUndefined();
  });

  it("resolves a learned alias to its camera", () => {
    const parsed = parseQuery(
      "Truck near loading dock",
      INITIAL_CAMERAS,
      [{ term: "Loading Dock", camera_id: "CAM_03", aliases: ["loading dock", "dock"] }],
    );
    expect(parsed.object_class).toBe("Truck");
    expect(parsed.cameras).toEqual(["CAM_03"]);
  });

  it("parses an explicit camera reference", () => {
    const parsed = parseQuery("White car on Cam 2", INITIAL_CAMERAS, []);
    expect(parsed.cameras).toEqual(["CAM_02"]);
    expect(parsed.attributes).toContain("white");
  });
});
