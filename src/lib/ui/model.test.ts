import assert from "node:assert/strict";
import { test } from "node:test";
import { verdictOf } from "./model";

const lit = { control: { has: true } };
const dark = { control: { has: false } };

test("no crossings is green", () => assert.equal(verdictOf([]), "green"));
test("every crossing has a light or gate nearby: yellow", () => assert.equal(verdictOf([lit, lit]), "yellow"));
test("any crossing with no light or gate nearby: red", () => assert.equal(verdictOf([lit, dark]), "red"));

