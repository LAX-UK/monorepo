import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  APPLY_COMMAND,
  MAX_LOCK_TIMEOUT_MS,
  parseBackfillArgs,
  parseDuration,
  resumeCommand,
} from "./backfill-payment-refund-args.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SCRIPT = "db:backfill-payment-refund";

/** What pnpm hands the script for a command line: everything after the script name, `--` included. */
function scriptArgv(command: string): string[] {
  const words = command.trim().split(/\s+/);
  const at = words.indexOf(SCRIPT);
  if (at < 0) throw new Error(`not a ${SCRIPT} command: ${command}`);
  return words.slice(at + 1);
}

/** Every `pnpm ... db:backfill-payment-refund ...` command quoted in the runbook. */
function runbookCommands(): string[] {
  const text = readFileSync(`${REPO_ROOT}docs/runbooks/monitoring-alerts.md`, "utf8");
  return [
    ...text.matchAll(/`(?:DATABASE_URL=\.\.\. )?(pnpm [^`]*db:backfill-payment-refund[^`]*)`/g),
  ].map((match) => match[1] ?? "");
}

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("parseDuration", () => {
  it("reads ms, s, m and bare milliseconds", () => {
    expect(parseDuration("500ms")).toBe(500);
    expect(parseDuration("5s")).toBe(5000);
    expect(parseDuration("1m")).toBe(60_000);
    expect(parseDuration("250")).toBe(250);
    expect(parseDuration("0")).toBe(0);
    expect(parseDuration(` ${MAX_LOCK_TIMEOUT_MS}`)).toBe(MAX_LOCK_TIMEOUT_MS);
  });

  it("rejects non-durations and values above the Postgres maximum", () => {
    for (const bad of ["", "abc", "-1s", "1.5s", "5h", "3000000000", "99999999999m"]) {
      expect(() => parseDuration(bad), bad).toThrow();
    }
    expect(() => parseDuration(String(MAX_LOCK_TIMEOUT_MS + 1))).toThrow(/too large/);
  });
});

describe("parseBackfillArgs", () => {
  it("uses defaults for a dry run with no flags", () => {
    expect(parseBackfillArgs([])).toEqual({
      apply: false,
      batchSize: 200,
      lockTimeoutMs: 5000,
      resumeAfter: null,
    });
  });

  it("accepts valid flags", () => {
    expect(
      parseBackfillArgs([
        "--apply",
        "--batch-size=50",
        "--lock-timeout=10s",
        `--resume-after=${ID}`,
      ]),
    ).toEqual({ apply: true, batchSize: 50, lockTimeoutMs: 10_000, resumeAfter: ID });
    expect(parseBackfillArgs(["--lock-timeout=0"]).lockTimeoutMs).toBe(0);
  });

  it("rejects present-but-empty flags", () => {
    for (const flag of ["--lock-timeout=", "--batch-size=", "--resume-after="]) {
      expect(() => parseBackfillArgs(["--apply", flag]), flag).toThrow();
    }
  });

  it("rejects out-of-range values", () => {
    for (const flag of [
      "--lock-timeout=2147483648",
      "--lock-timeout=3000000000",
      "--batch-size=0",
      "--batch-size=-5",
      "--batch-size=1.5",
      "--batch-size=abc",
      "--batch-size=9007199254740993",
    ]) {
      expect(() => parseBackfillArgs([flag]), flag).toThrow();
    }
  });

  it("rejects a resume cursor that is not a uuid", () => {
    expect(() => parseBackfillArgs(["--resume-after=not-a-uuid"])).toThrow(/uuid/);
  });

  it("rejects unknown flags and stray arguments", () => {
    for (const arg of [
      "--aply",
      "--batchsize=5",
      "--batch-size",
      "--dry-run",
      "apply",
      "--apply=1",
      "--verbose=1",
      "5",
    ]) {
      expect(() => parseBackfillArgs([arg]), arg).toThrow(/Unknown argument/);
    }
  });

  it("rejects repeated flags instead of letting the first win", () => {
    expect(() => parseBackfillArgs(["--apply", "--apply"])).toThrow(/more than once/);
    expect(() => parseBackfillArgs(["--batch-size=5", "--batch-size=6"])).toThrow(/more than once/);
    expect(() => parseBackfillArgs(["--lock-timeout=1s", "--lock-timeout=2s"])).toThrow(
      /more than once/,
    );
    expect(() => parseBackfillArgs([`--resume-after=${ID}`, `--resume-after=${ID}`])).toThrow(
      /more than once/,
    );
  });

  it("skips the `--` pnpm passes through, wherever it appears", () => {
    expect(parseBackfillArgs(["--", "--apply"])).toEqual(parseBackfillArgs(["--apply"]));
    expect(parseBackfillArgs(["--"]).apply).toBe(false);
    expect(parseBackfillArgs(["--apply", "--", "--batch-size=7"]).batchSize).toBe(7);
    expect(() => parseBackfillArgs(["--", "--aply"])).toThrow(/Unknown argument "--aply"/);
  });
});

describe("the documented commands", () => {
  it("the runbook quotes the --apply command, and every command it quotes parses", () => {
    const commands = runbookCommands();
    expect(commands).toContain(APPLY_COMMAND);
    for (const command of commands) {
      expect(() => parseBackfillArgs(scriptArgv(command)), command).not.toThrow();
    }
    expect(parseBackfillArgs(scriptArgv(APPLY_COMMAND)).apply).toBe(true);
  });

  it("the printed resume command parses back to the same run", () => {
    const args = { batchSize: 250, lockTimeoutMs: 10_000 };
    expect(resumeCommand(args, ID)).toBe(
      `${APPLY_COMMAND} --batch-size=250 --lock-timeout=10000ms --resume-after=${ID}`,
    );
    expect(parseBackfillArgs(scriptArgv(resumeCommand(args, ID)))).toEqual({
      apply: true,
      ...args,
      resumeAfter: ID,
    });
    expect(parseBackfillArgs(scriptArgv(resumeCommand(args, null)))).toEqual({
      apply: true,
      ...args,
      resumeAfter: null,
    });
  });

  // Runs the exact strings through pnpm and the script, with no DATABASE_URL: an accepted
  // command line gets past argument checking and stops at "Set DATABASE_URL." before connecting.
  const run = (command: string) => {
    const { DATABASE_URL: _unset, ...env } = process.env;
    const result = spawnSync("sh", ["-c", command], { cwd: REPO_ROOT, env, encoding: "utf8" });
    return { status: result.status, stderr: result.stderr };
  };

  it("pnpm runs the runbook command and the resume command as written", () => {
    for (const command of [
      APPLY_COMMAND,
      resumeCommand({ batchSize: 200, lockTimeoutMs: 5000 }, ID),
    ]) {
      const { status, stderr } = run(command);
      expect(stderr, command).toContain("Set DATABASE_URL.");
      expect(stderr, command).not.toContain("Unknown argument");
      expect(status, command).toBe(1);
    }
    const typo = run(`${APPLY_COMMAND} --batch-size=abc`);
    expect(typo.stderr).toContain("--batch-size");
    expect(typo.stderr).not.toContain("Set DATABASE_URL.");
  }, 60_000);
});
