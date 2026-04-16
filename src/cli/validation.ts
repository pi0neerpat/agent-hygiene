import chalk from "chalk";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseIntegerOption(
  value: string | undefined,
  optionName: string,
  min: number,
  max: number,
): number | null {
  if (value === undefined) return null;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${optionName} must be an integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${optionName} must be between ${min} and ${max}.`);
  }

  return parsed;
}

export function validateDateOption(
  value: string | undefined,
  optionName: string,
): void {
  if (value === undefined) return;
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`${optionName} must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${optionName} must be a valid calendar date.`);
  }
}

export function exitWithCliError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`Error: ${message}`));
  process.exit(1);
}
